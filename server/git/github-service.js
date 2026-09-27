const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const https = require('https');

const DATA_DIR = path.resolve(__dirname, '../../data');
const TOKEN_FILE = path.join(DATA_DIR, 'github_auth.enc');
const KEY_FILE = path.join(DATA_DIR, 'secret.key');

fs.mkdirSync(DATA_DIR, { recursive: true });

function getOrCreateKey() {
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64) {
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE);
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key);
  return key;
}

const MASTER_KEY = getOrCreateKey();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag,
    encrypted
  });
}

function decrypt(cipherObj) {
  try {
    const iv = Buffer.from(cipherObj.iv, 'hex');
    const authTag = Buffer.from(cipherObj.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherObj.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption failed:', e.message);
    return null;
  }
}

function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

class GitHubService {
  constructor() {
    this.tokenData = this.loadToken();
  }

  loadToken() {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    try {
      const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
      const payload = JSON.parse(raw);
      const token = decrypt(payload);
      if (!token) return null;
      return {
        token,
        user: payload.user || null,
        updatedAt: payload.updatedAt || null
      };
    } catch (e) {
      return null;
    }
  }

  saveToken(token, user = null) {
    const enc = JSON.parse(encrypt(token));
    enc.user = user;
    enc.updatedAt = new Date().toISOString();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(enc, null, 2), 'utf8');
    this.tokenData = { token, user, updatedAt: enc.updatedAt };
  }

  clearToken() {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
    this.tokenData = null;
  }

  getAuthStatus() {
    if (!this.tokenData || !this.tokenData.token) {
      return { connected: false };
    }
    return {
      connected: true,
      user: this.tokenData.user,
      updatedAt: this.tokenData.updatedAt
    };
  }

  async verifyAndFetchUser(token) {
    const res = await httpsRequest({
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        'User-Agent': 'jcode-agent',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.statusCode === 200) {
      return {
        login: res.data.login,
        name: res.data.name || res.data.login,
        avatar_url: res.data.avatar_url,
        html_url: res.data.html_url
      };
    }
    if (res.statusCode === 401) {
      throw new Error('GitHub token expired or invalid (401)');
    }
    throw new Error(res.data.message || `GitHub API error: ${res.statusCode}`);
  }

  async createRepo(token, repoName, isPrivate = false, org = null) {
    const path = org ? `/orgs/${org}/repos` : '/user/repos';
    const res = await httpsRequest({
      hostname: 'api.github.com',
      path,
      method: 'POST',
      headers: {
        'User-Agent': 'jcode-agent',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    }, {
      name: repoName,
      private: isPrivate,
      auto_init: false,
      description: 'Built with jcode AI autonomous coding agent'
    });

    if (res.statusCode === 201) {
      return res.data;
    }
    throw new Error(res.data.message || `Failed to create repo: HTTP ${res.statusCode}`);
  }

  async createPullRequest(token, owner, repo, title, body, head, base = 'main') {
    const res = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/pulls`,
      method: 'POST',
      headers: {
        'User-Agent': 'jcode-agent',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    }, {
      title,
      body,
      head,
      base
    });

    if (res.statusCode === 201) {
      return res.data;
    }
    throw new Error(res.data.message || `Failed to create PR: HTTP ${res.statusCode}`);
  }

  getGitStatus(projectDir) {
    if (!fs.existsSync(projectDir)) {
      return { isRepo: false };
    }

    const gitDir = path.join(projectDir, '.git');
    if (!fs.existsSync(gitDir)) {
      return { isRepo: false };
    }

    try {
      const branch = execSync('git branch --show-current', { cwd: projectDir, encoding: 'utf8' }).trim() || 'main';
      const porcelain = execSync('git status --porcelain', { cwd: projectDir, encoding: 'utf8' });
      const hasUncommitted = porcelain.trim().length > 0;
      
      let diff = '';
      try {
        diff = execSync('git diff HEAD', { cwd: projectDir, encoding: 'utf8' });
      } catch (e) {
        diff = porcelain;
      }

      let lastCommit = null;
      try {
        lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { cwd: projectDir, encoding: 'utf8' }).trim();
      } catch (e) {
        // No commits yet
      }

      let remoteUrl = null;
      try {
        remoteUrl = execSync('git remote get-url origin', { cwd: projectDir, encoding: 'utf8' }).trim();
      } catch (e) {
        // No remote yet
      }

      return {
        isRepo: true,
        branch,
        hasUncommitted,
        uncommittedFiles: porcelain.split('\n').filter(Boolean),
        diff: diff.slice(0, 5000),
        lastCommit,
        remoteUrl
      };
    } catch (e) {
      return { isRepo: false, error: e.message };
    }
  }

  pushToGitHub(projectDir, token, options = {}) {
    const { repoOwner, repoName, branch = 'main', commitMessage = 'Updates from jcode' } = options;
    const authUrl = `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`;

    const gitDir = path.join(projectDir, '.git');
    const isNew = !fs.existsSync(gitDir);

    if (isNew) {
      execSync('git init', { cwd: projectDir });
      execSync('git config user.name "jcode Agent"', { cwd: projectDir });
      execSync('git config user.email "agent@jcode.ai"', { cwd: projectDir });
      execSync(`git branch -M ${branch}`, { cwd: projectDir });
      execSync(`git remote add origin ${authUrl}`, { cwd: projectDir });
    } else {
      try {
        execSync(`git remote set-url origin ${authUrl}`, { cwd: projectDir });
      } catch (e) {
        execSync(`git remote add origin ${authUrl}`, { cwd: projectDir });
      }
    }

    execSync('git add -A', { cwd: projectDir });

    try {
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: projectDir });
    } catch (e) {
      // Nothing to commit if clean
    }

    execSync(`git push -u origin ${branch}`, { cwd: projectDir });

    const lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { cwd: projectDir, encoding: 'utf8' }).trim();

    return {
      success: true,
      lastCommit,
      branch,
      repoUrl: `https://github.com/${repoOwner}/${repoName}`
    };
  }

  cloneRepo(repoUrl, targetDir, token = null) {
    fs.mkdirSync(targetDir, { recursive: true });
    let authUrl = repoUrl;
    if (token && repoUrl.startsWith('https://github.com/')) {
      const slug = repoUrl.replace('https://github.com/', '');
      authUrl = `https://x-access-token:${token}@github.com/${slug}`;
    }

    execSync(`git clone ${authUrl} .`, { cwd: targetDir });
    return true;
  }
}

module.exports = new GitHubService();
