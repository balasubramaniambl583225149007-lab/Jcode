import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor, 
  FileCode, 
  Folder, 
  FolderOpen, 
  Save, 
  FolderGit2, 
  GitBranch, 
  UploadCloud, 
  GitPullRequest, 
  Check, 
  AlertCircle,
  FilePlus,
  Trash2
} from 'lucide-react';

function FileTreeNode({ node, level = 0, selectedPath, onSelectFile }) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedPath === node.path;

  if (node.type === 'directory') {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            paddingLeft: `${8 + level * 14}px`,
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            borderRadius: '4px',
            userSelect: 'none'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isOpen ? <FolderOpen size={14} color="#facc15" /> : <Folder size={14} color="#facc15" />}
          <span>{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child, i) => (
              <FileTreeNode
                key={i}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        paddingLeft: `${8 + level * 14}px`,
        cursor: 'pointer',
        fontSize: '0.8rem',
        color: isSelected ? '#fff' : 'var(--text-secondary)',
        backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        borderRadius: '2px'
      }}
      onMouseOver={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
      }}
      onMouseOut={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <FileCode size={14} color={isSelected ? 'var(--accent)' : 'var(--text-muted)'} />
      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{node.name}</span>
    </div>
  );
}

export default function WorkspacePanel({
  session,
  previewUrl,
  previewPort,
  previewReady,
  gitStatus,
  onRefreshGit,
  onPushToGitHub,
  onOpenPR,
  githubConnected,
  onOpenSettings
}) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code' | 'git'
  const [viewport, setViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [iframeKey, setIframeKey] = useState(0);

  // File tree & editor state
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Git Modal state
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushRepoName, setPushRepoName] = useState('');
  const [pushIsPrivate, setPushIsPrivate] = useState(false);
  const [pushCommitMsg, setPushCommitMsg] = useState('Update from jcode platform');
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState(null);

  // Load file tree when switching to code tab
  useEffect(() => {
    if (session && (activeTab === 'code' || activeTab === 'git')) {
      loadFileTree();
    }
  }, [session, activeTab]);

  const loadFileTree = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/files`);
      if (res.ok) {
        const tree = await res.json();
        setFileTree(tree);
        // Default select first file if none selected
        if (!selectedFile && tree.length > 0) {
          const firstFile = findFirstFile(tree);
          if (firstFile) handleSelectFile(firstFile.path);
        }
      }
    } catch (e) {
      console.error('Failed to load file tree:', e);
    }
  };

  const findFirstFile = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'file') return node;
      if (node.type === 'directory' && node.children) {
        const found = findFirstFile(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const handleSelectFile = async (filePath) => {
    setSelectedFile(filePath);
    try {
      const res = await fetch(`/api/sessions/${session.id}/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch (e) {
      console.error('Failed to fetch file content:', e);
    }
  };

  const handleSaveFile = async () => {
    if (!session || !selectedFile) return;
    setIsSavingFile(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        // Reload preview frame
        setIframeKey(k => k + 1);
      }
    } catch (e) {
      console.error('Failed to save file:', e);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handlePushSubmit = async (e) => {
    e.preventDefault();
    if (!pushRepoName.trim()) return;
    setIsPushing(true);
    setPushError(null);
    setPushResult(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          repoName: pushRepoName.trim(),
          isPrivate: pushIsPrivate,
          commitMessage: pushCommitMsg,
          createRepo: !session.github?.linked
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Push failed');
      }
      setPushResult(data);
      onRefreshGit();
      setTimeout(() => setShowPushModal(false), 2500);
    } catch (err) {
      setPushError(err.message);
    } finally {
      setIsPushing(false);
    }
  };

  // Viewport sizes
  const viewportWidth = 
    viewport === 'mobile' ? '375px' : 
    viewport === 'tablet' ? '768px' : '100%';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* Top Tab Bar & Toolbar */}
      <div style={{
        height: '52px',
        padding: '0 1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'preview' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'preview' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <Play size={13} />
            <span>Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'code' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'code' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <FileCode size={13} />
            <span>Code (Files)</span>
          </button>

          <button
            onClick={() => setActiveTab('git')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'git' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'git' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <FolderGit2 size={13} />
            <span>Git</span>
            {gitStatus?.hasUncommitted && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--yellow)'
              }} />
            )}
          </button>
        </div>

        {/* Right Toolbar Controls */}
        {activeTab === 'preview' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Viewport Toggles */}
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                onClick={() => setViewport('desktop')}
                title="Desktop view (100%)"
                style={{
                  background: viewport === 'desktop' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  color: viewport === 'desktop' ? '#fff' : 'var(--text-muted)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <Monitor size={14} />
              </button>
              <button
                onClick={() => setViewport('tablet')}
                title="Tablet view (768px)"
                style={{
                  background: viewport === 'tablet' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  color: viewport === 'tablet' ? '#fff' : 'var(--text-muted)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <Tablet size={14} />
              </button>
              <button
                onClick={() => setViewport('mobile')}
                title="Mobile view (375px)"
                style={{
                  background: viewport === 'mobile' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  color: viewport === 'mobile' ? '#fff' : 'var(--text-muted)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <Smartphone size={14} />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => setIframeKey(k => k + 1)}
              title="Refresh preview"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem'
              }}
            >
              <RefreshCw size={13} />
            </button>

            {/* Open in new tab */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              title="Open in new tab"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                borderRadius: '6px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem'
              }}
            >
              <ExternalLink size={13} />
            </a>

            {/* Push to GitHub quick button */}
            <button
              onClick={() => setShowPushModal(true)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <UploadCloud size={13} color="var(--accent)" />
              <span>Push</span>
            </button>
          </div>
        )}

        {activeTab === 'code' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSaveFile}
              disabled={isSavingFile || !selectedFile}
              style={{
                backgroundColor: saveSuccess ? 'var(--green)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'background 0.2s'
              }}
            >
              {saveSuccess ? <Check size={14} /> : <Save size={14} />}
              <span>{saveSuccess ? 'Saved & Hot-Reloaded' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#05070d',
            overflow: 'auto',
            padding: viewport === 'desktop' ? '0' : '1.5rem'
          }}>
            <div style={{
              width: viewportWidth,
              height: '100%',
              maxWidth: '100%',
              boxShadow: viewport === 'desktop' ? 'none' : '0 20px 50px rgba(0,0,0,0.6)',
              borderRadius: viewport === 'desktop' ? '0' : '12px',
              border: viewport === 'desktop' ? 'none' : '1px solid var(--border-color)',
              overflow: 'hidden',
              backgroundColor: '#fff',
              position: 'relative'
            }}>
              <iframe
                key={iframeKey}
                src={previewUrl}
                title="Sandbox Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff'
                }}
              />
            </div>
          </div>
        )}

        {/* CODE TAB (Bolt.new style) */}
        {activeTab === 'code' && (
          <div style={{ flex: 1, display: 'flex', height: '100%' }}>
            {/* File Tree Left Column */}
            <div style={{
              width: '240px',
              borderRight: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0
            }}>
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)'
              }}>
                <span>EXPLORER</span>
                <button
                  onClick={loadFileTree}
                  title="Refresh files"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                {fileTree.map((node, i) => (
                  <FileTreeNode
                    key={i}
                    node={node}
                    selectedPath={selectedFile}
                    onSelectFile={handleSelectFile}
                  />
                ))}
              </div>
            </div>

            {/* Code Editor Right Column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#090d16' }}>
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FileCode size={13} color="var(--accent)" />
                <span>{selectedFile || 'No file selected'}</span>
              </div>

              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  whiteSpace: 'pre',
                  overflow: 'auto'
                }}
              />
            </div>
          </div>
        )}

        {/* GIT TAB */}
        {activeTab === 'git' && (
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Git & Repository Sync</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Push commits, manage branches, and open pull requests directly to GitHub.
                  </p>
                </div>
                <button
                  onClick={() => setShowPushModal(true)}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <UploadCloud size={15} />
                  <span>Push to GitHub</span>
                </button>
              </div>

              {/* Status Card */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Branch</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <GitBranch size={16} />
                      <span>{gitStatus?.branch || 'main'}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: gitStatus?.hasUncommitted ? 'var(--yellow)' : 'var(--green)'
                    }}>
                      {gitStatus?.hasUncommitted ? 'Uncommitted changes' : 'Working tree clean'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Commit</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {gitStatus?.lastCommit || 'No commits yet'}
                    </div>
                  </div>
                </div>

                {gitStatus?.uncommittedFiles && gitStatus.uncommittedFiles.length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      CHANGES TO BE COMMITTED ({gitStatus.uncommittedFiles.length} files)
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#fde047' }}>
                      {gitStatus.uncommittedFiles.map((f, i) => (
                        <div key={i}>{f}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Diff View */}
              {gitStatus?.diff && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>Uncommitted Diff</h4>
                  <pre style={{
                    backgroundColor: '#090d16',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-secondary)'
                  }}>
                    {gitStatus.diff}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PUSH TO GITHUB MODAL */}
      {showPushModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '460px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Push to GitHub
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Create or sync repository on your connected GitHub account.
            </p>

            {!githubConnected && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                fontSize: '0.8rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>GitHub is not connected.</span>
                <button
                  onClick={() => { setShowPushModal(false); onOpenSettings(); }}
                  style={{
                    background: 'var(--red)',
                    color: '#fff',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Connect Now
                </button>
              </div>
            )}

            <form onSubmit={handlePushSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Repository Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. my-jcode-app"
                  value={pushRepoName}
                  onChange={(e) => setPushRepoName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Commit Message
                </label>
                <input
                  type="text"
                  value={pushCommitMsg}
                  onChange={(e) => setPushCommitMsg(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={pushIsPrivate}
                  onChange={(e) => setPushIsPrivate(e.target.checked)}
                />
                <label htmlFor="isPrivate" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Private repository
                </label>
              </div>

              {pushError && (
                <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  Error: {pushError}
                </div>
              )}

              {pushResult && (
                <div style={{ color: 'var(--green)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} />
                  <span>Pushed successfully to {pushResult.repoUrl}!</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPushModal(false)}
                  style={{
                    padding: '8px 14px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPushing || !pushRepoName.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    cursor: isPushing ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isPushing ? <RefreshCw size={14} className="spinner" /> : <UploadCloud size={14} />}
                  <span>{isPushing ? 'Pushing...' : 'Confirm & Push'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
