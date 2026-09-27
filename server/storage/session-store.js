const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.resolve(__dirname, '../../data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../../projects');

// Ensure base directories exist
fs.mkdirSync(SESSIONS_DIR, { recursive: true });
fs.mkdirSync(PROJECTS_BASE_DIR, { recursive: true });

class SessionStore {
  constructor() {
    this.sessionsCache = new Map();
    this.loadAll();
  }

  loadAll() {
    try {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(SESSIONS_DIR, file);
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const session = JSON.parse(raw);
            this.sessionsCache.set(session.id, session);
          } catch (e) {
            console.error(`Failed to parse session file ${file}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error('Error loading sessions:', e.message);
    }
  }

  saveSession(session) {
    session.updatedAt = new Date().toISOString();
    this.sessionsCache.set(session.id, session);
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  }

  listSessions() {
    const list = Array.from(this.sessionsCache.values());
    return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getSession(id) {
    if (this.sessionsCache.has(id)) {
      return this.sessionsCache.get(id);
    }
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const session = JSON.parse(raw);
        this.sessionsCache.set(session.id, session);
        return session;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  createSession(options = {}) {
    const id = options.id || uuidv4();
    const projectDir = path.join(PROJECTS_BASE_DIR, id);
    fs.mkdirSync(projectDir, { recursive: true });

    const session = {
      id,
      name: options.name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectDir,
      messages: [],
      projectType: 'unknown',
      previewUrl: `/preview/${id}/`,
      devServer: {
        status: 'stopped',
        port: null,
        lastError: null
      },
      github: {
        linked: false,
        repoOwner: null,
        repoName: null,
        repoUrl: null,
        branch: 'main',
        lastCommit: null,
        lastPushedAt: null
      }
    };

    this.saveSession(session);
    return session;
  }

  updateSession(id, updates) {
    const session = this.getSession(id);
    if (!session) return null;

    Object.assign(session, updates);
    this.saveSession(session);
    return session;
  }

  deleteSession(id) {
    this.sessionsCache.delete(id);
    const sessionFile = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
    const projectDir = path.join(PROJECTS_BASE_DIR, id);
    if (fs.existsSync(projectDir)) {
      try {
        fs.rmSync(projectDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(`Could not remove project dir ${projectDir}:`, e.message);
      }
    }
    return true;
  }

  addMessage(sessionId, message) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const fullMessage = {
      id: message.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      role: message.role || 'user',
      content: message.content || '',
      events: message.events || [],
      timestamp: new Date().toISOString()
    };

    session.messages.push(fullMessage);
    
    // Auto-update project name if untitled and user message
    if (session.name === 'Untitled Project' && message.role === 'user' && message.content) {
      session.name = message.content.slice(0, 36).trim();
    }

    this.saveSession(session);
    return fullMessage;
  }

  getMessages(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.messages : [];
  }
}

module.exports = new SessionStore();
