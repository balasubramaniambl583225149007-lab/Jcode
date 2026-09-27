import React, { useState } from 'react';
import { 
  Plus, 
  Terminal, 
  Trash2, 
  FolderGit2, 
  Settings, 
  LogOut, 
  Search,
  ExternalLink,
  ChevronRight,
  Code2
} from 'lucide-react';

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onOpenSettings,
  onLogout,
  githubStatus
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(s => 
    (s.name || 'Untitled').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside style={{
      width: '280px',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* Header / Brand */}
      <div style={{
        padding: '1.25rem 1rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Terminal size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              jcode <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>STUDIO</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PTY Agent & Live Preview</div>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* New Project Button */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <button
          onClick={onCreateSession}
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.2s',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
        >
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '0 1rem 0.5rem' }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Sessions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem'
      }}>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          padding: '4px 8px 8px'
        }}>
          Projects & Sessions ({filteredSessions.length})
        </div>

        {filteredSessions.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8rem'
          }}>
            No projects found.
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '4px',
                  backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                  border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  group: 'session-item',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#fff' : 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {session.name || 'Untitled Project'}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '2px'
                  }}>
                    <span>{new Date(session.updatedAt || session.createdAt).toLocaleDateString()}</span>
                    {session.projectType && session.projectType !== 'unknown' && (
                      <span style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent-light)',
                        color: '#a5b4fc',
                        fontSize: '0.65rem',
                        fontWeight: 600
                      }}>
                        {session.projectType}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this project session?')) {
                      onDeleteSession(session.id);
                    }
                  }}
                  title="Delete project"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--red)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* GitHub & User Bottom Footer */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'rgba(0,0,0,0.2)'
      }}>
        {/* GitHub Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: githubStatus && githubStatus.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: githubStatus && githubStatus.connected ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={16} color={githubStatus && githubStatus.connected ? 'var(--green)' : 'var(--text-muted)'} />
            <div style={{ fontSize: '0.75rem' }}>
              {githubStatus && githubStatus.connected ? (
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>@{githubStatus.user?.login || 'Connected'}</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>GitHub Not Linked</span>
              )}
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {githubStatus && githubStatus.connected ? 'Manage' : 'Connect'}
          </button>
        </div>

        {/* Logout */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Single-User Mode
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--red)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
