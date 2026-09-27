import React, { useState } from 'react';
import { 
  Bot, 
  User, 
  Brain, 
  Wrench, 
  FileCode, 
  Terminal, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Copy, 
  Wand2 
} from 'lucide-react';

function ThinkingBlock({ thoughts, isLive }) {
  const [open, setOpen] = useState(true);

  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div style={{
      marginBottom: '12px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'rgba(168, 85, 247, 0.08)',
      border: '1px solid rgba(168, 85, 247, 0.2)',
      overflow: 'hidden'
    }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: 'rgba(168, 85, 247, 0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={16} color="var(--purple)" className={isLive ? 'pulse' : ''} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d8b4fe' }}>
            Thinking & Analysis ({thoughts.length} steps)
          </span>
          {isLive && (
            <span style={{
              fontSize: '0.65rem',
              backgroundColor: 'var(--purple)',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 600
            }}>
              Active
            </span>
          )}
        </div>
        {open ? <ChevronDown size={14} color="#d8b4fe" /> : <ChevronRight size={14} color="#d8b4fe" />}
      </div>

      {open && (
        <div style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#c084fc', lineHeight: 1.5 }}>
          {thoughts.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--purple)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ tool, args, result }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      overflow: 'hidden'
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: 'rgba(99, 102, 241, 0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={15} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a5b4fc' }}>
            Tool Execution: <code style={{ color: '#fff', fontWeight: 700 }}>{tool}</code>
          </span>
          {args && args.path && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ({args.path})
            </span>
          )}
        </div>
        {open ? <ChevronDown size={14} color="#a5b4fc" /> : <ChevronRight size={14} color="#a5b4fc" />}
      </div>

      {open && (
        <div style={{ padding: '8px 12px', fontSize: '0.75rem', backgroundColor: '#090d16' }}>
          {args && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Parameters:</div>
              <pre style={{ margin: 0, color: '#38bdf8', overflowX: 'auto', fontFamily: 'monospace' }}>
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Result:</div>
              <div style={{ color: 'var(--green)', fontFamily: 'monospace' }}>{result}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffCard({ path: filePath, diff }) {
  const [open, setOpen] = useState(true);

  if (!diff) return null;
  const lines = diff.split('\n');

  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: '#090d16',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderBottom: open ? '1px solid var(--border-color)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCode size={15} color="var(--yellow)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            File Edit: <code style={{ color: '#fde047' }}>{filePath}</code>
          </span>
        </div>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {open && (
        <div style={{
          maxHeight: '260px',
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
          fontSize: '0.75rem',
          lineHeight: '1.4'
        }}>
          {lines.map((line, idx) => {
            let bg = 'transparent';
            let color = 'var(--text-secondary)';
            if (line.startsWith('+')) {
              bg = 'rgba(16, 185, 129, 0.15)';
              color = '#34d399';
            } else if (line.startsWith('-')) {
              bg = 'rgba(239, 68, 68, 0.15)';
              color = '#f87171';
            } else if (line.startsWith('@@')) {
              color = '#38bdf8';
            }
            return (
              <div key={idx} style={{ backgroundColor: bg, color, padding: '1px 4px', whiteSpace: 'pre-wrap' }}>
                {line}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShellCard({ command, output, exitCode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: '#090d16',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          cursor: 'pointer',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderBottom: open ? '1px solid var(--border-color)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="var(--green)" />
          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#86efac' }}>
            $ {command}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '0.65rem',
            padding: '1px 5px',
            borderRadius: '4px',
            backgroundColor: exitCode === 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            color: exitCode === 0 ? 'var(--green)' : 'var(--red)',
            fontWeight: 600
          }}>
            exit {exitCode}
          </span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {open && output && (
        <div style={{
          maxHeight: '180px',
          overflowY: 'auto',
          padding: '8px 12px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap'
        }}>
          {output}
        </div>
      )}
    </div>
  );
}

export function ErrorFeedbackCard({ error, onAutoFix }) {
  return (
    <div style={{
      margin: '12px 0',
      padding: '12px 14px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <AlertCircle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fca5a5' }}>
            Build / Dev Server Error Detected
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: '#f87171',
            fontFamily: 'monospace',
            marginTop: '4px',
            maxHeight: '90px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            background: 'rgba(0,0,0,0.3)',
            padding: '6px 8px',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          onClick={() => onAutoFix(error)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--red)',
            color: '#fff',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Wand2 size={13} />
          <span>⚡ Auto-fix with jcode</span>
        </button>
      </div>
    </div>
  );
}

export default function MessageItem({ message, onAutoFix }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '16px 20px',
      backgroundColor: isUser ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
      borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
    }}>
      {/* Avatar */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        backgroundColor: isUser ? '#3b82f6' : '#6366f1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        flexShrink: 0
      }}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {isUser ? 'You' : 'jcode Agent'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={copyText}
              title="Copy message"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Structured Events (Thinking, Tool calls, Diffs, Shell commands) */}
        {!isUser && message.events && message.events.length > 0 && (
          <div style={{ margin: '8px 0' }}>
            {message.events.map((ev, i) => {
              if (ev.type === 'thinking') {
                return <ThinkingBlock key={i} thoughts={ev.thoughts} isLive={false} />;
              }
              if (ev.type === 'tool_call') {
                return <ToolCallCard key={i} tool={ev.tool} args={ev.args} result={ev.result} />;
              }
              if (ev.type === 'file_edit') {
                return <DiffCard key={i} path={ev.path} diff={ev.diff} />;
              }
              if (ev.type === 'shell_command') {
                return <ShellCard key={i} command={ev.command} output={ev.output} exitCode={ev.exitCode} />;
              }
              return null;
            })}
          </div>
        )}

        {/* Message Text / Markdown Content */}
        {message.content && (
          <div style={{
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
