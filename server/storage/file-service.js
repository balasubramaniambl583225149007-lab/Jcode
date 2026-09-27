const fs = require('fs');
const path = require('path');

const IGNORE_PATTERNS = ['.git', 'node_modules', '.next', 'dist', '__pycache__', '.DS_Store'];

function getFileTree(dir, basePath = '') {
  if (!fs.existsSync(dir)) return [];

  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (IGNORE_PATTERNS.includes(item.name)) continue;

      const itemRelPath = path.join(basePath, item.name);
      const itemFullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        results.push({
          name: item.name,
          path: itemRelPath,
          type: 'directory',
          children: getFileTree(itemFullPath, itemRelPath)
        });
      } else {
        const ext = path.extname(item.name).toLowerCase();
        results.push({
          name: item.name,
          path: itemRelPath,
          type: 'file',
          ext,
          size: fs.statSync(itemFullPath).size
        });
      }
    }
  } catch (e) {
    console.error('Error reading dir:', e.message);
  }

  // Sort directories first, then files
  return results.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

function getFileContent(projectDir, relPath) {
  const safePath = path.resolve(projectDir, relPath);
  if (!safePath.startsWith(projectDir)) {
    throw new Error('Access denied: path outside project directory');
  }
  if (!fs.existsSync(safePath)) {
    throw new Error('File not found');
  }
  return fs.readFileSync(safePath, 'utf8');
}

function saveFileContent(projectDir, relPath, content) {
  const safePath = path.resolve(projectDir, relPath);
  if (!safePath.startsWith(projectDir)) {
    throw new Error('Access denied: path outside project directory');
  }
  fs.mkdirSync(path.dirname(safePath), { recursive: true });
  fs.writeFileSync(safePath, content, 'utf8');
  return true;
}

function deleteFile(projectDir, relPath) {
  const safePath = path.resolve(projectDir, relPath);
  if (!safePath.startsWith(projectDir)) {
    throw new Error('Access denied: path outside project directory');
  }
  if (fs.existsSync(safePath)) {
    fs.rmSync(safePath, { recursive: true, force: true });
  }
  return true;
}

module.exports = {
  getFileTree,
  getFileContent,
  saveFileContent,
  deleteFile
};
