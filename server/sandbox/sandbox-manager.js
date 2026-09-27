const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');
const EventEmitter = require('events');
const httpProxy = require('http-proxy');

// Starting port for sandboxes
let NEXT_PORT = 4100;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    const port = NEXT_PORT++;
    if (NEXT_PORT > 4900) NEXT_PORT = 4100;

    server.listen(port, '0.0.0.0', () => {
      server.once('close', () => resolve(port));
      server.close();
    });
    server.on('error', () => {
      resolve(getAvailablePort());
    });
  });
}

function checkPortReady(port, maxAttempts = 40, delayMs = 300) {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        timeout: 250
      }, (res) => {
        clearInterval(interval);
        resolve(true);
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.end();
    }, delayMs);
  });
}

class SandboxManager extends EventEmitter {
  constructor() {
    super();
    this.sandboxes = new Map(); // sessionId -> sandbox instance
    this.proxy = httpProxy.createProxyServer({
      ws: true,
      changeOrigin: true,
      xfwd: true
    });

    this.proxy.on('error', (err, req, res) => {
      console.warn('Proxy error:', err.message);
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/html' });
        res.end(`
          <div style="font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; min-height: 100vh;">
            <h2 style="color: #ef4444;">Dev Server Not Ready</h2>
            <p>The sandbox is starting up or compiling. Please refresh in a moment.</p>
            <pre style="background: #1e293b; padding: 1rem; border-radius: 8px; font-size: 0.85rem;">${err.message}</pre>
          </div>
        `);
      }
    });

    // Idle sandbox reaper - runs every 60 seconds
    this.reaperInterval = setInterval(() => {
      this.reapIdleSandboxes();
    }, 60000);
  }

  detectProjectType(projectDir) {
    if (!fs.existsSync(projectDir)) return 'unknown';

    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const scripts = pkg.scripts || {};

        if (deps.vite || (scripts.dev && scripts.dev.includes('vite'))) {
          return 'vite';
        }
        if (deps.next) {
          return 'next';
        }
        if (deps['react-scripts']) {
          return 'cra';
        }
        if (deps.express) {
          return 'express';
        }
        return 'node';
      } catch (e) {
        return 'node';
      }
    }

    if (fs.existsSync(path.join(projectDir, 'index.html'))) {
      return 'static-html';
    }

    if (fs.existsSync(path.join(projectDir, 'requirements.txt')) || fs.existsSync(path.join(projectDir, 'app.py')) || fs.existsSync(path.join(projectDir, 'main.py'))) {
      return 'python';
    }

    return 'unknown';
  }

  async ensureDependencies(projectDir, projectType) {
    if (['vite', 'next', 'cra', 'express', 'node'].includes(projectType)) {
      const pkgPath = path.join(projectDir, 'package.json');
      const nodeModules = path.join(projectDir, 'node_modules');
      if (fs.existsSync(pkgPath) && !fs.existsSync(nodeModules)) {
        try {
          this.emit('log', { message: 'Installing project dependencies...' });
          execSync('npm install --prefer-offline --no-audit --no-fund', {
            cwd: projectDir,
            timeout: 60000,
            stdio: 'ignore'
          });
        } catch (e) {
          console.warn('npm install warning:', e.message);
        }
      }
    }
  }

  async startDevServer(sessionId, projectDir) {
    // If sandbox already running on this session, stop or reuse
    if (this.sandboxes.has(sessionId)) {
      const existing = this.sandboxes.get(sessionId);
      if (existing.status === 'running') {
        existing.lastActivity = Date.now();
        return existing;
      }
      this.stopDevServer(sessionId);
    }

    const projectType = this.detectProjectType(projectDir);
    await this.ensureDependencies(projectDir, projectType);

    const port = await getAvailablePort();
    let command = '';
    let args = [];

    switch (projectType) {
      case 'vite':
        command = 'npx';
        args = ['vite', '--host', '0.0.0.0', '--port', String(port), '--strictPort'];
        break;
      case 'next':
        command = 'npx';
        args = ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'];
        break;
      case 'cra':
        command = 'npx';
        args = ['react-scripts', 'start'];
        break;
      case 'express':
      case 'node': {
        const entry = fs.existsSync(path.join(projectDir, 'server.js'))
          ? 'server.js'
          : fs.existsSync(path.join(projectDir, 'index.js'))
          ? 'index.js'
          : 'app.js';
        command = 'node';
        args = [entry];
        break;
      }
      case 'python':
        if (fs.existsSync(path.join(projectDir, 'main.py'))) {
          command = 'python3';
          args = ['main.py'];
        } else if (fs.existsSync(path.join(projectDir, 'app.py'))) {
          command = 'python3';
          args = ['app.py'];
        } else {
          command = 'python3';
          args = ['-m', 'http.server', String(port), '--bind', '0.0.0.0'];
        }
        break;
      case 'static-html':
      default:
        command = 'python3';
        args = ['-m', 'http.server', String(port), '--bind', '0.0.0.0'];
        break;
    }

    const sandbox = {
      sessionId,
      projectDir,
      projectType,
      port,
      process: null,
      status: 'starting',
      lastActivity: Date.now(),
      errorLogs: [],
      ready: false
    };

    this.sandboxes.set(sessionId, sandbox);

    const env = {
      ...process.env,
      PORT: String(port),
      HOST: '0.0.0.0',
      BROWSER: 'none',
      CI: 'true'
    };

    try {
      const child = spawn(command, args, {
        cwd: projectDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      sandbox.process = child;

      child.stdout.on('data', (buf) => {
        const text = buf.toString('utf8');
        sandbox.lastActivity = Date.now();

        // Check for Vite / dev server ready strings
        if (
          text.includes('ready in') ||
          text.includes('Local:') ||
          text.includes('Serving HTTP') ||
          text.includes('listening on')
        ) {
          sandbox.status = 'running';
          sandbox.ready = true;
          this.emit('ready', { sessionId, port, projectType });
        }
      });

      child.stderr.on('data', (buf) => {
        const text = buf.toString('utf8');
        sandbox.lastActivity = Date.now();
        sandbox.errorLogs.push(text);

        // Detect critical build / syntax errors to feed back to chat
        if (
          text.includes('error') ||
          text.includes('Error:') ||
          text.includes('SyntaxError') ||
          text.includes('Failed to compile')
        ) {
          this.emit('error', {
            sessionId,
            message: text.slice(0, 500),
            fullError: text
          });
        }
      });

      child.on('exit', (code) => {
        sandbox.status = 'stopped';
        sandbox.ready = false;
        this.emit('stopped', { sessionId, code });
      });

      // Poll port in parallel to ensure prompt readiness detection
      checkPortReady(port, 40, 250).then((isReady) => {
        if (isReady && sandbox.status === 'starting') {
          sandbox.status = 'running';
          sandbox.ready = true;
          this.emit('ready', { sessionId, port, projectType });
        }
      });

      return sandbox;
    } catch (err) {
      sandbox.status = 'error';
      sandbox.errorLogs.push(err.message);
      this.emit('error', { sessionId, message: err.message });
      return sandbox;
    }
  }

  stopDevServer(sessionId) {
    if (this.sandboxes.has(sessionId)) {
      const sandbox = this.sandboxes.get(sessionId);
      if (sandbox.process) {
        try {
          sandbox.process.kill('SIGTERM');
        } catch (e) {
          // ignore
        }
      }
      sandbox.status = 'stopped';
      sandbox.ready = false;
      this.sandboxes.delete(sessionId);
    }
  }

  restartDevServer(sessionId, projectDir) {
    this.stopDevServer(sessionId);
    return this.startDevServer(sessionId, projectDir);
  }

  getSandbox(sessionId) {
    return this.sandboxes.get(sessionId);
  }

  reapIdleSandboxes(maxIdleMs = 15 * 60 * 1000) {
    const now = Date.now();
    for (const [sessionId, sandbox] of this.sandboxes.entries()) {
      if (sandbox.status === 'running' && now - sandbox.lastActivity > maxIdleMs) {
        console.log(`Auto-suspending idle sandbox for session ${sessionId}`);
        this.stopDevServer(sessionId);
      }
    }
  }

  // Handle reverse proxy for iframe live preview
  handleProxy(req, res, sessionId) {
    let sandbox = this.sandboxes.get(sessionId);
    if (!sandbox || sandbox.status !== 'running' || !sandbox.port) {
      res.writeHead(503, { 'Content-Type': 'text/html' });
      return res.end(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 1.5rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid #6366f1; border-top-color: transparent; animation: spin 1s linear infinite; margin-bottom: 1.5rem;"></div>
          <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          <h2 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem 0;">Dev server starting...</h2>
          <p style="color: #94a3b8; font-size: 0.9rem; max-width: 400px; margin: 0 0 1rem 0;">jcode is initializing the sandbox and preparing your live preview.</p>
          <button onclick="window.location.reload()" style="background: #4f46e5; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: 500;">Reload</button>
        </div>
      `);
    }

    sandbox.lastActivity = Date.now();

    // Strip the /preview/:sessionId prefix so the request hits the dev server root
    const prefix = `/preview/${sessionId}`;
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length) || '/';
    }

    this.proxy.web(req, res, {
      target: `http://127.0.0.1:${sandbox.port}`
    });
  }

  handleUpgrade(req, socket, head, sessionId) {
    const sandbox = this.sandboxes.get(sessionId);
    if (sandbox && sandbox.status === 'running' && sandbox.port) {
      sandbox.lastActivity = Date.now();
      const prefix = `/preview/${sessionId}`;
      if (req.url.startsWith(prefix)) {
        req.url = req.url.slice(prefix.length) || '/';
      }
      this.proxy.ws(req, socket, head, {
        target: `ws://127.0.0.1:${sandbox.port}`
      });
    } else {
      socket.destroy();
    }
  }
}

module.exports = new SandboxManager();
