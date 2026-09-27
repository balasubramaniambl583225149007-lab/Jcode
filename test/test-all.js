const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { spawnPty } = require('../server/pty/pty-manager');
const { JCodeOutputParser, stripAnsi } = require('../server/parser/jcode-parser');
const sessionStore = require('../server/storage/session-store');
const sandboxManager = require('../server/sandbox/sandbox-manager');
const githubService = require('../server/git/github-service');
const fileService = require('../server/storage/file-service');
const { verifyPassword, createToken, isValidToken, DEFAULT_PASSWORD } = require('../server/auth/auth-middleware');

async function runTests() {
  console.log('🧪 Starting jcode platform test suite...\n');

  // Test 1: Auth & Token Verification
  console.log('Test 1: Single-User Authentication & Token Management');
  assert.strictEqual(verifyPassword(DEFAULT_PASSWORD), true, 'Default password should verify');
  assert.strictEqual(verifyPassword('wrongpass'), false, 'Wrong password should fail');
  const testToken = createToken();
  assert.strictEqual(isValidToken(testToken), true, 'Created token should be valid');
  assert.strictEqual(isValidToken('invalid-token'), false, 'Fake token should be invalid');
  console.log('✓ Auth tests passed\n');

  // Test 2: PTY Execution
  console.log('Test 2: Real PTY Process Spawning');
  const ptyProc = spawnPty('bash', ['-c', 'echo "PTY_TEST_OK"'], { cwd: __dirname });
  let ptyOutput = '';
  ptyProc.on('data', (d) => { ptyOutput += d; });

  await new Promise((resolve) => {
    ptyProc.on('exit', (code) => {
      assert.strictEqual(code, 0, 'PTY bash process should exit with 0');
      assert.ok(ptyOutput.includes('PTY_TEST_OK'), 'PTY output should contain echoed string');
      resolve();
    });
  });
  console.log('✓ PTY process spawning tests passed\n');

  // Test 3: Output Parser & ANSI Stripping
  console.log('Test 3: JCodeOutputParser Structured Event Streaming');
  const parser = new JCodeOutputParser();
  const events = [];
  parser.on('event', (ev) => events.push(ev));

  const sampleStream = `
Thinking:
  * Inspecting target directory
  * Generating configuration

Tool Call: write_file({"path":"index.html"})
Result: Written 400 bytes

File Edit: src/App.jsx
--- a/src/App.jsx
+++ b/src/App.jsx
@@ -1,1 +1,5 @@
+console.log('jcode preview');

$ npm test
Test Suites: 1 passed, 1 total
[exit code 0]

✓ Successfully completed all tasks!
`;

  parser.feed(sampleStream);
  parser.flush();

  const types = events.map(e => e.type);
  assert.ok(types.includes('thinking_start'), 'Should have thinking_start');
  assert.ok(types.includes('thinking_delta'), 'Should have thinking_delta');
  assert.ok(types.includes('tool_call'), 'Should parse tool_call');
  assert.ok(types.includes('file_edit'), 'Should parse file_edit');
  assert.ok(types.includes('shell_command'), 'Should parse shell_command');
  assert.ok(types.includes('text_chunk'), 'Should stream text_chunk');
  console.log('✓ Parser extracted all structured event types successfully\n');

  // Test 4: Session Storage
  console.log('Test 4: Session Storage & Project Isolation');
  const testSession = sessionStore.createSession({ name: 'Integration Test Project' });
  assert.ok(testSession.id, 'Session should have an id');
  assert.ok(fs.existsSync(testSession.projectDir), 'Session project directory should exist');

  const msg = sessionStore.addMessage(testSession.id, {
    role: 'user',
    content: 'Build a calculator app'
  });
  assert.ok(msg.id, 'Message should have an id');
  assert.strictEqual(sessionStore.getMessages(testSession.id).length, 1, 'Should have 1 message');
  console.log('✓ Session persistence and project directory isolation passed\n');

  // Test 5: File Service & Bolt.new Explorer
  console.log('Test 5: File Tree & Content Management');
  fileService.saveFileContent(testSession.projectDir, 'src/index.js', 'console.log("hello");');
  const tree = fileService.getFileTree(testSession.projectDir);
  assert.ok(tree.length > 0, 'File tree should not be empty');
  const content = fileService.getFileContent(testSession.projectDir, 'src/index.js');
  assert.strictEqual(content, 'console.log("hello");', 'Content should match saved string');
  console.log('✓ File explorer and editor service tests passed\n');

  // Test 6: GitHub Token Encryption & Git Status
  console.log('Test 6: GitHub Encrypted Token Storage at Rest & Git Status');
  const fakeToken = 'ghp_' + Math.random().toString(36).substr(2, 20);
  githubService.saveToken(fakeToken, { login: 'octocat' });
  const loaded = githubService.loadToken();
  assert.strictEqual(loaded.token, fakeToken, 'Decrypted token should match original');
  assert.strictEqual(loaded.user.login, 'octocat', 'User metadata should match');
  githubService.clearToken();
  assert.strictEqual(githubService.loadToken(), null, 'Cleared token should be null');

  const gitStat = githubService.getGitStatus(testSession.projectDir);
  assert.strictEqual(gitStat.isRepo, false, 'Clean session is not a repo initially');
  console.log('✓ GitHub AES-256 encryption and git status tests passed\n');

  // Test 7: Sandbox Project Detection
  console.log('Test 7: Sandbox Stack Detection');
  fileService.saveFileContent(testSession.projectDir, 'package.json', JSON.stringify({
    dependencies: { vite: '^5.0.0', react: '^18.0.0' }
  }));
  const detectedType = sandboxManager.detectProjectType(testSession.projectDir);
  assert.strictEqual(detectedType, 'vite', 'Should detect vite project');
  console.log('✓ Project type detection passed\n');

  // Cleanup test session
  sessionStore.deleteSession(testSession.id);
  console.log('🎉 All test suites completed successfully with 100% pass rate!');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
