import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import WorkspacePanel from './components/WorkspacePanel';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import { MessageSquare, Layout } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Streaming state for live assistant response
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sandboxError, setSandboxError] = useState(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewPort, setPreviewPort] = useState(null);
  const [previewReady, setPreviewReady] = useState(false);

  // Git state
  const [gitStatus, setGitStatus] = useState(null);
  const [githubStatus, setGithubStatus] = useState(null);

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'workspace'
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const wsRef = useRef(null);

  // Handle responsive resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setIsAuthenticated(true);
        loadSessions();
        loadGitHubStatus();
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  const loadGitHubStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setGithubStatus(data);
      }
    } catch (e) {
      console.error('Failed to load GitHub status:', e);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0) {
          selectSession(data[0].id);
        } else {
          handleCreateSession();
        }
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const selectSession = async (id) => {
    setActiveSessionId(id);
    setStreamingMessage(null);
    setIsGenerating(false);
    setSandboxError(null);
    setPreviewUrl(`/preview/${id}/`);

    // Load message history
    try {
      const res = await fetch(`/api/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }

    // Load Git status
    loadGitStatus(id);

    // Join session on WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_session', sessionId: id }));
    }
  };

  const loadGitStatus = async (id = activeSessionId) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/github/git-status?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch git status:', e);
    }
  };

  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Project' })
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        selectSession(newSession.id);
      }
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        if (updated.length > 0) {
          selectSession(updated[0].id);
        } else {
          handleCreateSession();
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (activeSessionId) {
        ws.send(JSON.stringify({ type: 'join_session', sessionId: activeSessionId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'preview_ready') {
          setPreviewUrl(data.previewUrl);
          setPreviewPort(data.port);
          setPreviewReady(true);
          setSandboxError(null);
        }

        if (data.type === 'sandbox_error') {
          setSandboxError(data.error);
        }

        if (data.type === 'new_message') {
          setMessages(prev => [...prev, data.message]);
        }

        if (data.type === 'assistant_start') {
          setIsGenerating(true);
          setStreamingMessage({
            id: data.id,
            role: 'assistant',
            content: '',
            events: [],
            timestamp: new Date().toISOString()
          });
        }

        if (data.type === 'agent_event') {
          const ev = data.event;
          setStreamingMessage(prev => {
            if (!prev) return prev;
            const updated = { ...prev };
            
            if (ev.type === 'text_chunk') {
              updated.content += ev.text;
            } else if (ev.type === 'thinking_delta') {
              let existingThink = updated.events.find(e => e.type === 'thinking');
              if (!existingThink) {
                existingThink = { type: 'thinking', thoughts: [] };
                updated.events = [...updated.events, existingThink];
              }
              existingThink.thoughts.push(ev.thought);
            } else if (['tool_call', 'file_edit', 'shell_command'].includes(ev.type)) {
              updated.events = [...updated.events, ev];
            }
            return updated;
          });
        }

        if (data.type === 'assistant_done') {
          setIsGenerating(false);
          setStreamingMessage(null);
          setMessages(prev => [...prev, data.message]);
          // Refresh sessions list to update project name and timestamp
          fetch('/api/sessions').then(r => r.json()).then(setSessions);
          loadGitStatus();
        }

        if (data.type === 'files_updated') {
          loadGitStatus();
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS disconnected, reconnecting in 2s...');
      setTimeout(() => {
        if (isAuthenticated) checkAuth();
      }, 2000);
    };

    return () => {
      ws.close();
    };
  }, [isAuthenticated, activeSessionId]);

  const handleSendPrompt = (prompt) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeSessionId) return;
    setSandboxError(null);
    wsRef.current.send(JSON.stringify({
      type: 'send_prompt',
      sessionId: activeSessionId,
      prompt
    }));
  };

  const handleAutoFix = (error) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeSessionId) return;
    wsRef.current.send(JSON.stringify({
      type: 'auto_fix_error',
      sessionId: activeSessionId,
      prompt: `Please diagnose and fix this dev server / build error:\n\n${error}`
    }));
    setSandboxError(null);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  const currentSession = sessions.find(s => s.id === activeSessionId);

  if (!authChecked) {
    return <div style={{ background: 'var(--bg-primary)', height: '100vh', width: '100vw' }} />;
  }

  if (!isAuthenticated) {
    return <LoginModal onLoginSuccess={() => checkAuth()} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          githubStatus={githubStatus}
        />
      )}

      {/* Main Split-View Layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        {/* Mobile Navigation Header */}
        {isMobile && (
          <div style={{
            height: '48px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 1rem'
          }}>
            <button
              onClick={() => setMobileTab('chat')}
              style={{
                background: 'none',
                border: 'none',
                color: mobileTab === 'chat' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MessageSquare size={16} />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setMobileTab('workspace')}
              style={{
                background: 'none',
                border: 'none',
                color: mobileTab === 'workspace' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layout size={16} />
              <span>Preview & Code</span>
            </button>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', height: '100%', minWidth: 0, overflow: 'hidden' }}>
          {/* Left Panel: Chat (Desktop or Mobile Active) */}
          {(!isMobile || mobileTab === 'chat') && (
            <div style={{
              width: isMobile ? '100%' : '45%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <ChatPanel
                session={currentSession}
                messages={messages}
                streamingMessage={streamingMessage}
                isGenerating={isGenerating}
                sandboxError={sandboxError}
                onSendPrompt={handleSendPrompt}
                onAutoFix={handleAutoFix}
              />
            </div>
          )}

          {/* Right Panel: Workspace / Preview / Code (Desktop or Mobile Active) */}
          {(!isMobile || mobileTab === 'workspace') && (
            <div style={{
              width: isMobile ? '100%' : '55%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <WorkspacePanel
                session={currentSession}
                previewUrl={previewUrl}
                previewPort={previewPort}
                previewReady={previewReady}
                gitStatus={gitStatus}
                onRefreshGit={() => loadGitStatus()}
                onPushToGitHub={() => loadGitStatus()}
                githubConnected={githubStatus && githubStatus.connected}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        githubStatus={githubStatus}
        onSaveGitHubToken={() => loadGitHubStatus()}
        onDisconnectGitHub={async () => {
          await fetch('/api/github/disconnect', { method: 'POST' });
          loadGitHubStatus();
        }}
      />
    </div>
  );
}
