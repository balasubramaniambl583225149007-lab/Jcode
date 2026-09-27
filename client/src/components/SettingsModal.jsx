import React, { useState } from 'react';
import { X, Key, FolderGit2, Check, AlertCircle, RefreshCw, Cpu, Shield } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  githubStatus,
  onSaveGitHubToken,
  onDisconnectGitHub
}) {
  const [githubToken, setGithubToken] = useState('');
  const [isVerifyingGit, setIsVerifyingGit] = useState(false);
  const [gitMsg, setGitMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('github'); // 'github' | 'sandbox' | 'models'

  if (!isOpen) return null;

  const handleConnectGitHub = async (e) => {
    e.preventDefault();
    if (!githubToken.trim()) return;
    setIsVerifyingGit(true);
    setGitMsg(null);

    try {
      const res = await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setGitMsg({ type: 'success', text: `Connected as @${data.user.login}!` });
      onSaveGitHubToken();
      setGithubToken('');
    } catch (err) {
      setGitMsg({ type: 'error', text: err.message });
    } finally {
      setIsVerifyingGit(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        width: '540px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--accent)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Platform Settings</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(0,0,0,0.2)'
        }}>
          <button
            onClick={() => setActiveTab('github')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'github' ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === 'github' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'github' ? '2px solid var(--accent)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}
          >
            GitHub Integration
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'sandbox' ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === 'sandbox' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'sandbox' ? '2px solid var(--accent)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}
          >
            Sandbox & Runtime
          </button>
          <button
            onClick={() => setActiveTab('models')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'models' ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === 'models' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'models' ? '2px solid var(--accent)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}
          >
            AI Engine (LLMs)
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '1.5rem' }}>
          {activeTab === 'github' && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Connect your GitHub account to enable 1-click Push to GitHub, automatic repo creation, and opening Pull Requests.
                Tokens are encrypted with AES-256-GCM at rest.
              </p>

              {githubStatus?.connected ? (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FolderGit2 size={20} color="var(--green)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
                        Connected as @{githubStatus.user?.login}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Scoped with repo permissions
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onDisconnectGitHub}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--red)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConnectGitHub}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      GitHub Personal Access Token (classic or fine-grained with <code>repo</code> scope)
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {gitMsg && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.8rem',
                      backgroundColor: gitMsg.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
                      color: gitMsg.type === 'success' ? 'var(--green)' : 'var(--red)'
                    }}>
                      {gitMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifyingGit || !githubToken.trim()}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: isVerifyingGit ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isVerifyingGit ? <RefreshCw size={16} className="spinner" /> : <Shield size={16} />}
                    <span>{isVerifyingGit ? 'Verifying...' : 'Save & Verify Connection'}</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                Sandboxes provide isolated execution environments with real PTY terminals, dev server reverse proxies, and auto-suspension.
              </p>

              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Active Provider: Local POSIX Sandbox</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Per-session directory isolation, dynamic port pooling (4100-4900), and automated idle suspension (15 min).
                </div>
              </div>

              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Managed Provider: E2B / CodeSandbox SDK
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Set <code>E2B_API_KEY</code> or <code>CODESANDBOX_API_KEY</code> in environment to switch to remote cloud microVMs.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                <code>jcode</code> CLI works out-of-the-box with its built-in generative engine, or connects to external LLMs.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Anthropic Claude Code</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Configured via <code>ANTHROPIC_API_KEY</code></div>
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>OpenAI Codex / GPT-4</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Configured via <code>OPENAI_API_KEY</code></div>
                </div>

                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Custom CLI Executable</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Configured via <code>JCODE_BIN_PATH</code></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
