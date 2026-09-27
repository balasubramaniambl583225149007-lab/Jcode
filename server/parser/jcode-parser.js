const EventEmitter = require('events');

// Regex to remove terminal control codes (colors, cursor movements, erase line)
const ANSI_REGEX = new RegExp(
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  'g'
);

function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(ANSI_REGEX, '') : str;
}

class JCodeOutputParser extends EventEmitter {
  constructor() {
    super();
    this.buffer = '';
    this.currentMode = 'text'; // 'text' | 'thinking' | 'tool' | 'diff' | 'shell'
    this.currentEntity = null;
    this.thoughtItems = [];
    this.isComplete = false;
  }

  feed(chunk) {
    const raw = stripAnsi(chunk.toString('utf8'));
    this.buffer += raw;

    const lines = this.buffer.split(/\r?\n/);
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop();

    for (const line of lines) {
      this.processLine(line);
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
    this.flushCurrentEntity();
  }

  flushCurrentEntity() {
    if (!this.currentEntity) return;

    if (this.currentMode === 'thinking') {
      this.emit('event', {
        type: 'thinking',
        thoughts: [...this.thoughtItems],
        id: this.currentEntity.id
      });
      this.thoughtItems = [];
    } else if (this.currentMode === 'diff') {
      this.emit('event', {
        type: 'file_edit',
        path: this.currentEntity.path,
        diff: this.currentEntity.diffLines.join('\n'),
        id: this.currentEntity.id
      });
    } else if (this.currentMode === 'shell') {
      this.emit('event', {
        type: 'shell_command',
        command: this.currentEntity.command,
        output: this.currentEntity.outputLines.join('\n'),
        exitCode: this.currentEntity.exitCode !== undefined ? this.currentEntity.exitCode : 0,
        id: this.currentEntity.id
      });
    } else if (this.currentMode === 'tool') {
      this.emit('event', {
        type: 'tool_call',
        tool: this.currentEntity.tool,
        args: this.currentEntity.args,
        result: this.currentEntity.result,
        id: this.currentEntity.id
      });
    }

    this.currentEntity = null;
    this.currentMode = 'text';
  }

  processLine(rawLine) {
    const line = rawLine.trim();

    // Skip empty lines in some states
    if (!line) {
      if (this.currentMode === 'text') {
        this.emit('event', { type: 'text_chunk', text: '\n' });
      }
      return;
    }

    // Ignore banner lines
    if (line.startsWith('╔═') || line.startsWith('╚═') || line.startsWith('║') || line.includes('jcode agent v')) {
      return;
    }

    // Check for thinking block start
    if (line.toLowerCase().startsWith('thinking:') || line.includes('⠋ Thinking') || line.includes('[Thinking]')) {
      this.flushCurrentEntity();
      this.currentMode = 'thinking';
      this.thoughtItems = [];
      this.currentEntity = { id: 'think_' + Date.now() };
      this.emit('event', { type: 'thinking_start', id: this.currentEntity.id });
      return;
    }

    // If currently in thinking mode
    if (this.currentMode === 'thinking') {
      if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
        const thought = line.replace(/^[\*\-•]\s*/, '');
        this.thoughtItems.push(thought);
        this.emit('event', {
          type: 'thinking_delta',
          thought,
          id: this.currentEntity.id
        });
        return;
      }
      // If we encounter a new section header, flush thinking
      if (line.startsWith('Tool Call:') || line.startsWith('File Edit:') || line.startsWith('$') || line.startsWith('✓')) {
        this.flushCurrentEntity();
      } else {
        this.thoughtItems.push(line);
        this.emit('event', {
          type: 'thinking_delta',
          thought: line,
          id: this.currentEntity.id
        });
        return;
      }
    }

    // Check for Tool Call
    if (line.startsWith('Tool Call:') || line.startsWith('Tool:')) {
      this.flushCurrentEntity();
      this.currentMode = 'tool';
      const match = line.match(/(?:Tool Call:|Tool:)\s*([a-zA-Z0-9_\-\.]+)(?:\((.*)\))?/);
      let toolName = 'unknown';
      let args = {};
      if (match) {
        toolName = match[1];
        if (match[2]) {
          try {
            args = JSON.parse(match[2]);
          } catch (e) {
            args = { raw: match[2] };
          }
        }
      }
      this.currentEntity = {
        id: 'tool_' + Date.now(),
        tool: toolName,
        args,
        result: ''
      };
      this.emit('event', {
        type: 'tool_call',
        tool: toolName,
        args,
        id: this.currentEntity.id
      });
      return;
    }

    if (this.currentMode === 'tool') {
      if (line.startsWith('Result:')) {
        const res = line.replace(/^Result:\s*/, '');
        this.currentEntity.result = res;
        this.flushCurrentEntity();
        return;
      }
    }

    // Check for File Edit / Diff
    if (line.startsWith('File Edit:') || line.startsWith('--- a/')) {
      this.flushCurrentEntity();
      this.currentMode = 'diff';
      let filePath = 'file';
      if (line.startsWith('File Edit:')) {
        filePath = line.replace(/^File Edit:\s*/, '');
      } else if (line.startsWith('--- a/')) {
        filePath = line.replace(/^---\s*a\//, '');
      }
      this.currentEntity = {
        id: 'diff_' + Date.now(),
        path: filePath,
        diffLines: [line]
      };
      return;
    }

    if (this.currentMode === 'diff') {
      if (
        line.startsWith('+++ b/') ||
        line.startsWith('@@') ||
        line.startsWith('+') ||
        line.startsWith('-') ||
        line.startsWith(' ')
      ) {
        this.currentEntity.diffLines.push(line);
        return;
      } else {
        // End of diff block
        this.flushCurrentEntity();
      }
    }

    // Check for Shell Command
    if (line.startsWith('$ ') || line.startsWith('> npm') || line.startsWith('> git')) {
      this.flushCurrentEntity();
      this.currentMode = 'shell';
      const command = line.replace(/^(\$|>)\s*/, '');
      this.currentEntity = {
        id: 'shell_' + Date.now(),
        command,
        outputLines: [],
        exitCode: 0
      };
      return;
    }

    if (this.currentMode === 'shell') {
      if (line.includes('[exit code')) {
        const codeMatch = line.match(/\[exit code\s*(\d+)\]/);
        if (codeMatch) {
          this.currentEntity.exitCode = parseInt(codeMatch[1], 10);
        }
        this.flushCurrentEntity();
        return;
      } else if (line.startsWith('✓') || line.startsWith('Tool Call:') || line.startsWith('File Edit:')) {
        this.flushCurrentEntity();
      } else {
        this.currentEntity.outputLines.push(rawLine);
        return;
      }
    }

    // Check for terminal prompts like "jcode> "
    if (line === 'jcode>' || line.startsWith('jcode>')) {
      this.flushCurrentEntity();
      this.emit('event', { type: 'status', status: 'idle' });
      return;
    }

    // Regular text / markdown stream
    this.emit('event', {
      type: 'text_chunk',
      text: rawLine + '\n'
    });
  }
}

module.exports = {
  JCodeOutputParser,
  stripAnsi
};
