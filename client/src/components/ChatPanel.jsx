import React, { useState, useRef, useEffect } from 'react';
import MessageItem, { ErrorFeedbackCard } from './MessageItem';
import { Send, Sparkles, RefreshCw, Terminal, AlertCircle } from 'lucide-react';

const SUGGESTIONS = [
  "Create a modern Todo app with filters and dark mode",
  "Build a real-time crypto price tracker with charts",
  "Create an interactive Pomodoro timer with sound alerts",
  "Build a markdown note-taking app with preview"
];

export default function ChatPanel({
  session,
  messages,
  streamingMessage,
  isGenerating,
  sandboxError,
  onSendPrompt,
  onAutoFix
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendPrompt(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      {/* Chat Header */}
      <div style={{
        height: '52px',
        padding: '0 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isGenerating ? 'var(--yellow)' : 'var(--green)',
            boxShadow: isGenerating ? '0 0 8px var(--yellow)' : '0 0 8px var(--green)'
          }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {session ? session.name : 'Select a Project'}
          </span>
          {session?.projectType && session.projectType !== 'unknown' && (
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent)',
              fontWeight: 600
            }}>
              {session.projectType}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isGenerating ? 'jcode is working...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {messages.length === 0 && !streamingMessage && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: '1rem'
            }}>
              <Sparkles size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              What would you like jcode to build?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              jcode will write the code in an isolated sandbox, auto-detect the stack, launch the dev server, and stream live interactive preview.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
              maxWidth: '440px'
            }}>
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onSendPrompt(sug)}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <Sparkles size={13} color="var(--accent)" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} onAutoFix={onAutoFix} />
        ))}

        {/* Live Streaming Message */}
        {streamingMessage && (
          <MessageItem message={streamingMessage} onAutoFix={onAutoFix} />
        )}

        {/* Sandbox Dev Server Error Card */}
        {sandboxError && (
          <div style={{ padding: '0 20px' }}>
            <ErrorFeedbackCard error={sandboxError} onAutoFix={onAutoFix} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <form onSubmit={handleSubmit} style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? "jcode is running..." : "Ask jcode to build or modify something... (Press Enter to send)"}
            disabled={isGenerating}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.4
            }}
          />

          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: input.trim() && !isGenerating ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
              color: input.trim() && !isGenerating ? '#fff' : 'var(--text-muted)',
              border: 'none',
              cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              marginLeft: '8px'
            }}
          >
            {isGenerating ? <RefreshCw size={16} className="spinner" /> : <Send size={16} />}
          </button>
        </form>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
          Shift + Enter for new line • jcode runs in isolated sandboxes with live PTY
        </div>
      </div>
    </div>
  );
}
