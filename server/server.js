const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');

require('dotenv').config();

const sessionStore = require('./storage/session-store');
const sandboxManager = require('./sandbox/sandbox-manager');
const githubService = require('./git/github-service');
const fileService = require('./storage/file-service');
const { spawnPty } = require('./pty/pty-manager');
const { JCodeOutputParser } = require('./parser/jcode-parser');
const {
  authMiddleware,
  verifyPassword,
  createToken,
  isValidToken,
  DEFAULT_PASSWORD,
  masterToken
} = require('./auth/auth-middleware');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = parseInt(process.env.PORT || '3000', 10);
const JCODE_BIN = process.env.JCODE_BIN_PATH || path.resolve(__dirname, '../bin/jcode');

app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Reverse proxy for live preview iframes
app.use('/preview/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  sandboxManager.handleProxy(req, res, sessionId);
});

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (verifyPassword(password)) {
    const token = createToken();
    res.cookie('jcode_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400 * 1000 });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Invalid password' });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies && req.cookies.jcode_token;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (isValidToken(token)) {
    return res.json({ authenticated: true, user: { name: 'Developer', role: 'admin' } });
  }
  return res.status(401).json({ authenticated: false });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('jcode_token');
  res.json({ success: true });
});

// Protect all /api endpoints below
app.use('/api', authMiddleware);

// Sessions API
app.get('/api/sessions', (req, res) => {
  res.json(sessionStore.listSessions());
});

app.post('/api/sessions', (req, res) => {
  const { name } = req.body;
  const session = sessionStore.createSession({ name });
  res.json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  sandboxManager.stopDevServer(req.params.id);
  sessionStore.deleteSession(req.params.id);
  res.json({ success: true });
});

app.post('/api/sessions/:id/rename', (req, res) => {
  const { name } = req.body;
  const session = sessionStore.updateSession(req.params.id, { name });
  res.json(session);
});

app.get('/api/sessions/:id/messages', (req, res) => {
  const messages = sessionStore.getMessages(req.params.id);
  res.json(messages);
});

// File Tree & Code Editor API (Bolt.new style)
app.get('/api/sessions/:id/files', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const tree = fileService.getFileTree(session.projectDir);
  res.json(tree);
});

app.get('/api/sessions/:id/file', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const filePath = req.query.path;
  try {
    const content = fileService.getFileContent(session.projectDir, filePath);
    res.json({ content, path: filePath });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/sessions/:id/file', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const { path: filePath, content } = req.body;
  try {
    fileService.saveFileContent(session.projectDir, filePath, content);
    broadcastToSession(session.id, { type: 'files_updated', path: filePath });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/sessions/:id/file', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const filePath = req.query.path;
  try {
    fileService.deleteFile(session.projectDir, filePath);
    broadcastToSession(session.id, { type: 'files_updated', deleted: filePath });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Sandbox & Dev Server Controls
app.post('/api/sessions/:id/sandbox/start', async (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const sandbox = await sandboxManager.startDevServer(session.id, session.projectDir);
  res.json({
    status: sandbox.status,
    port: sandbox.port,
    previewUrl: `/preview/${session.id}/`
  });
});

app.post('/api/sessions/:id/sandbox/restart', async (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const sandbox = await sandboxManager.restartDevServer(session.id, session.projectDir);
  res.json({
    status: sandbox.status,
    port: sandbox.port,
    previewUrl: `/preview/${session.id}/`
  });
});

app.post('/api/sessions/:id/sandbox/stop', (req, res) => {
  sandboxManager.stopDevServer(req.params.id);
  res.json({ success: true });
});

app.get('/api/sessions/:id/sandbox/status', (req, res) => {
  const sandbox = sandboxManager.getSandbox(req.params.id);
  if (!sandbox) {
    return res.json({ status: 'stopped', port: null });
  }
  res.json({
    status: sandbox.status,
    port: sandbox.port,
    projectType: sandbox.projectType,
    ready: sandbox.ready,
    previewUrl: `/preview/${req.params.id}/`
  });
});

// GitHub Integration API
app.get('/api/github/status', (req, res) => {
  res.json(githubService.getAuthStatus());
});

app.post('/api/github/token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  try {
    const user = await githubService.verifyAndFetchUser(token);
    githubService.saveToken(token, user);
    res.json({ success: true, user });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.post('/api/github/disconnect', (req, res) => {
  githubService.clearToken();
  res.json({ success: true });
});

app.get('/api/github/git-status', (req, res) => {
  const sessionId = req.query.sessionId;
  const session = sessionStore.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const status = githubService.getGitStatus(session.projectDir);
  res.json(status);
});

app.post('/api/github/push', async (req, res) => {
  const { sessionId, repoName, repoOwner, isPrivate, commitMessage, branch = 'main', createRepo = false } = req.body;
  const session = sessionStore.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const auth = githubService.loadToken();
  if (!auth || !auth.token) {
    return res.status(401).json({ error: 'GitHub not connected. Please connect your GitHub account in Settings.' });
  }

  try {
    let targetOwner = repoOwner || auth.user.login;

    if (createRepo) {
      await githubService.createRepo(auth.token, repoName, isPrivate);
    }

    const result = githubService.pushToGitHub(session.projectDir, auth.token, {
      repoOwner: targetOwner,
      repoName,
      branch,
      commitMessage: commitMessage || `Update from jcode [${new Date().toLocaleTimeString()}]`
    });

    sessionStore.updateSession(sessionId, {
      github: {
        linked: true,
        repoOwner: targetOwner,
        repoName,
        repoUrl: result.repoUrl,
        branch,
        lastCommit: result.lastCommit,
        lastPushedAt: new Date().toISOString()
      }
    });

    res.json(result);
  } catch (e) {
    if (e.message && e.message.includes('401')) {
      return res.status(401).json({ error: 'GitHub token expired or revoked. Please reconnect.' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/github/pr', async (req, res) => {
  const { sessionId, title, body, branchName, base = 'main' } = req.body;
  const session = sessionStore.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const auth = githubService.loadToken();
  if (!auth || !auth.token) {
    return res.status(401).json({ error: 'GitHub not connected' });
  }

  const gitMeta = session.github;
  if (!gitMeta || !gitMeta.repoName) {
    return res.status(400).json({ error: 'Session project is not linked to a GitHub repo yet' });
  }

  try {
    githubService.pushToGitHub(session.projectDir, auth.token, {
      repoOwner: gitMeta.repoOwner,
      repoName: gitMeta.repoName,
      branch: branchName,
      commitMessage: title
    });

    const pr = await githubService.createPullRequest(
      auth.token,
      gitMeta.repoOwner,
      gitMeta.repoName,
      title,
      body || 'Automated PR generated from jcode platform',
      branchName,
      base
    );

    res.json(pr);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/github/import', async (req, res) => {
  const { repoUrl, projectName } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required' });

  const session = sessionStore.createSession({
    name: projectName || repoUrl.split('/').pop().replace('.git', '')
  });

  const auth = githubService.loadToken();
  try {
    githubService.cloneRepo(repoUrl, session.projectDir, auth ? auth.token : null);
    await sandboxManager.startDevServer(session.id, session.projectDir);
    res.json(session);
  } catch (e) {
    sessionStore.deleteSession(session.id);
    res.status(500).json({ error: e.message });
  }
});

// Sandbox Events -> WebSocket forwarding
sandboxManager.on('ready', ({ sessionId, port, projectType }) => {
  sessionStore.updateSession(sessionId, {
    projectType,
    devServer: { status: 'running', port, lastError: null }
  });
  broadcastToSession(sessionId, {
    type: 'preview_ready',
    previewUrl: `/preview/${sessionId}/`,
    port,
    projectType
  });
});

sandboxManager.on('error', ({ sessionId, message, fullError }) => {
  sessionStore.updateSession(sessionId, {
    devServer: { status: 'error', lastError: message }
  });
  broadcastToSession(sessionId, {
    type: 'sandbox_error',
    error: message,
    fullError
  });
});

// Serve Vite React build in production
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/preview')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Active WebSocket connections per session
const sessionSockets = new Map(); // sessionId -> Set(ws)

function broadcastToSession(sessionId, payload) {
  const sockets = sessionSockets.get(sessionId);
  if (sockets) {
    const data = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }
}

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
  let currentSessionId = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString('utf8'));

      if (msg.type === 'join_session') {
        currentSessionId = msg.sessionId;
        if (!sessionSockets.has(currentSessionId)) {
          sessionSockets.set(currentSessionId, new Set());
        }
        sessionSockets.get(currentSessionId).add(ws);

        // Send current session state and preview readiness
        const session = sessionStore.getSession(currentSessionId);
        if (session) {
          ws.send(JSON.stringify({
            type: 'session_state',
            session
          }));

          const sandbox = sandboxManager.getSandbox(currentSessionId);
          if (sandbox && sandbox.status === 'running') {
            ws.send(JSON.stringify({
              type: 'preview_ready',
              previewUrl: `/preview/${currentSessionId}/`,
              port: sandbox.port,
              projectType: sandbox.projectType
            }));
          }
        }
      }

      if (msg.type === 'send_prompt' || msg.type === 'auto_fix_error') {
        const { sessionId, prompt } = msg;
        const session = sessionStore.getSession(sessionId);
        if (!session) return;

        // Record User Message
        const userMsg = sessionStore.addMessage(sessionId, {
          role: 'user',
          content: prompt
        });

        broadcastToSession(sessionId, {
          type: 'new_message',
          message: userMsg
        });

        // Assistant Message Placeholder
        const assistantMsgId = 'msg_' + Date.now();
        broadcastToSession(sessionId, {
          type: 'assistant_start',
          id: assistantMsgId
        });

        // Spawn jcode CLI inside session's project directory via real PTY
        const parser = new JCodeOutputParser();
        const collectedEvents = [];
        let fullTextContent = '';

        parser.on('event', (ev) => {
          collectedEvents.push(ev);

          if (ev.type === 'text_chunk') {
            fullTextContent += ev.text;
          }

          broadcastToSession(sessionId, {
            type: 'agent_event',
            messageId: assistantMsgId,
            event: ev
          });
        });

        // Spawn PTY process
        const ptyProc = spawnPty(JCODE_BIN, ['-p', prompt], {
          cwd: session.projectDir,
          env: {
            ...process.env,
            SESSION_ID: sessionId
          }
        });

        ptyProc.on('data', (chunk) => {
          parser.feed(chunk);
        });

        ptyProc.on('exit', async (exitCode) => {
          parser.flush();

          const assistantMsg = sessionStore.addMessage(sessionId, {
            id: assistantMsgId,
            role: 'assistant',
            content: fullTextContent,
            events: collectedEvents
          });

          broadcastToSession(sessionId, {
            type: 'assistant_done',
            message: assistantMsg
          });

          // Trigger File Tree Refresh
          broadcastToSession(sessionId, { type: 'files_updated' });

          // Auto-start / reload Dev Server for live preview
          try {
            await sandboxManager.startDevServer(sessionId, session.projectDir);
          } catch (err) {
            console.error('Error starting dev server after agent run:', err);
          }
        });
      }
    } catch (e) {
      console.error('WS message error:', e.message);
    }
  });

  ws.on('close', () => {
    if (currentSessionId && sessionSockets.has(currentSessionId)) {
      sessionSockets.get(currentSessionId).delete(ws);
    }
  });
});

// Upgrade handling for WebSockets and Preview proxies
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;

  if (pathname === '/ws' || pathname.startsWith('/ws?')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/preview/')) {
    const parts = pathname.split('/');
    const sessionId = parts[2];
    sandboxManager.handleUpgrade(request, socket, head, sessionId);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`   jcode Platform Server running on port ${PORT}`);
  console.log(`   Default Master Auth Token: ${masterToken}`);
  console.log(`   Default Password: ${DEFAULT_PASSWORD}`);
  console.log(`====================================================`);
});
