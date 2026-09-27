const crypto = require('crypto');

const DEFAULT_PASSWORD = process.env.APP_PASSWORD || 'jcode123';
const AUTH_SECRET = process.env.AUTH_SECRET || 'jcode-secret-token-' + crypto.randomBytes(8).toString('hex');
const activeTokens = new Set();

// Create default active token
const masterToken = 'jcode_' + crypto.createHash('sha256').update(DEFAULT_PASSWORD + AUTH_SECRET).digest('hex').slice(0, 24);
activeTokens.add(masterToken);

function verifyPassword(pwd) {
  return pwd === DEFAULT_PASSWORD;
}

function createToken() {
  const token = 'jtok_' + crypto.randomBytes(16).toString('hex');
  activeTokens.add(token);
  return token;
}

function isValidToken(token) {
  if (!token) return false;
  return activeTokens.has(token) || token === masterToken;
}

function authMiddleware(req, res, next) {
  // Allow public paths: login, preview iframe, assets, static client files
  const publicPrefixes = ['/api/auth/login', '/preview', '/assets', '/favicon.ico'];
  if (publicPrefixes.some(p => req.path.startsWith(p)) || req.path === '/' || !req.path.startsWith('/api')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies && req.cookies.jcode_token;

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (isValidToken(token)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
}

module.exports = {
  authMiddleware,
  verifyPassword,
  createToken,
  isValidToken,
  DEFAULT_PASSWORD,
  masterToken
};
