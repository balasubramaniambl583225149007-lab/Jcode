const path = require('path');
const { spawn: nodeSpawn } = require('child_process');
const EventEmitter = require('events');

let nodePty = null;
try {
  nodePty = require('node-pty');
} catch (e) {
  // node-pty not available, fallback to real python pty bridge
}

const BRIDGE_PATH = path.resolve(__dirname, 'pty-bridge.py');

class PtyProcess extends EventEmitter {
  constructor(child, isNativeNodePty = false) {
    super();
    this.child = child;
    this.isNative = isNativeNodePty;
    this.pid = child.pid;

    if (isNativeNodePty) {
      child.onData((data) => this.emit('data', data));
      child.onExit(({ exitCode, signal }) => this.emit('exit', exitCode, signal));
    } else {
      child.stdout.on('data', (buf) => this.emit('data', buf.toString('utf8')));
      child.stderr.on('data', (buf) => this.emit('data', buf.toString('utf8')));
      child.on('exit', (code, signal) => this.emit('exit', code, signal));
      child.on('error', (err) => this.emit('error', err));
    }
  }

  write(data) {
    if (this.isNative) {
      this.child.write(data);
    } else {
      if (this.child.stdin && !this.child.stdin.destroyed) {
        this.child.stdin.write(data);
      }
    }
  }

  resize(cols, rows) {
    if (this.isNative && this.child.resize) {
      this.child.resize(cols, rows);
    }
    // Bridge env vars were set on spawn; future resize ioctls can be sent if needed
  }

  kill(signal = 'SIGTERM') {
    if (this.isNative && this.child.kill) {
      this.child.kill(signal);
    } else {
      try {
        this.child.kill(signal);
      } catch (e) {
        // ignore
      }
    }
  }
}

function spawnPty(command, args = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const env = { ...process.env, ...(options.env || {}) };
  const cols = options.cols || 100;
  const rows = options.rows || 30;

  if (nodePty) {
    try {
      const ptyProcess = nodePty.spawn(command, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env
      });
      return new PtyProcess(ptyProcess, true);
    } catch (err) {
      console.warn('node-pty spawn failed, falling back to pty-bridge:', err.message);
    }
  }

  // Use pty-bridge.py
  const bridgeEnv = {
    ...env,
    PTY_COLS: String(cols),
    PTY_ROWS: String(rows),
    PTY_CWD: cwd
  };

  const child = nodeSpawn(BRIDGE_PATH, [command, ...args], {
    cwd,
    env: bridgeEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return new PtyProcess(child, false);
}

module.exports = {
  spawnPty,
  hasNativeNodePty: () => !!nodePty
};
