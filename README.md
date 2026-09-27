# jcode Studio Platform

A full-stack web application that wraps the `jcode` terminal AI coding agent (similar to Claude Code / Codex) into a polished platform combining the conversational experience of Claude.ai/ChatGPT with the live app-building experience of Lovable/Bolt.new, plus GitHub integration.

---

## 🌟 Highlights & Architecture

- **Interactive PTY Agent Layer:**
  - Spawns `jcode` CLI as an interactive subprocess in a true POSIX pseudo-terminal (`node-pty` / `pty-bridge.py`).
  - Real-time ANSI & token stream parser (`JCodeOutputParser`) converts terminal outputs into structured message events:
    - `ThinkingBlock`: Agent reasoning & planning steps with live pulse indicator.
    - `ToolCallCard`: Structured tool invocations (`write_file`, `bash`, `read_file`, etc.) with arguments and return results.
    - `DiffCard`: Interactive unified diff viewer with line-by-line red `-` deletions and green `+` additions.
    - `ShellCard`: Command executions (`$ npm install`, `$ git status`) with exit codes and collapsible output.
    - `ErrorFeedbackCard`: Intercepts dev server errors and presents an **⚡ Auto-fix with jcode** button to close the repair loop.
  - Per-session project isolation (`/projects/<sessionId>`) and persistent chat history (`/data/sessions/`).

- **Sandboxed Execution & Live Preview (Lovable/Bolt.new):**
  - Isolated sandboxes with automated stack detection (Vite, React, Next.js, Express, Python, Static HTML).
  - Automated dependency installation (`npm install`, `pip install`).
  - Dynamic port allocation and dev server readiness polling.
  - Reverse proxy (`/preview/<sessionId>/`) streaming directly into an iframe with viewport switching (Mobile 375px, Tablet 768px, Desktop 100%).
  - Error capture & hot-reload: Dev server stderr/stdout errors trigger feedback cards back into chat.
  - Idle sandbox reaper automatically suspends dormant dev servers after 15 minutes to save memory and CPU.

- **GitHub Integration:**
  - Token encryption at rest using AES-256-GCM.
  - 1-click **Push to GitHub**:
    - Creates personal/organization public or private repos on the fly if unlinked.
    - Generates commit messages, stages changes, and pushes to `main`.
  - **Create Branch & Open Pull Request** from the UI.
  - Live Git status strip showing current branch, uncommitted diffs, and ahead/behind status.
  - **Import Repository**: Clone an existing GitHub repo to jumpstart a new session.

- **Bolt.new-Style Code Explorer:**
  - Live interactive file tree browser.
  - In-browser code editor with syntax styling.
  - Instant save with automated preview hot-reload.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js**: v18+ (tested up to Node v24)
- **Python**: 3.8+ (for POSIX PTY bridge and HTTP servers)
- **Git**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/jcode.git
cd jcode

# Install server dependencies
npm install

# Install client dependencies & build frontend bundle
cd client
npm install
npm run build
cd ..
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Default configuration values:
- `PORT=3000`
- `APP_PASSWORD=jcode123` (Single-user gate password)
- `ENCRYPTION_KEY` (Auto-generated 256-bit key in `data/secret.key` if left blank)

### 4. Run the Platform
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Enter the password (`jcode123`) to unlock your workspace.

### 5. Running Automated Tests
```bash
npm test
```
Runs the end-to-end integration test suite verifying:
- PTY allocation and subprocess execution.
- Real-time stream parsing into structured events (thinking, tools, diffs, shell commands).
- Session persistence and message storage.
- File explorer and editor services.
- GitHub token encryption and Git status inspection.
- Sandbox project type detection.

---

## 🛠️ Configuration & Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `3000` |
| `APP_PASSWORD` | Single-user authentication password gate | `jcode123` |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM token encryption | Stored in `data/secret.key` |
| `JCODE_BIN_PATH` | Path to custom agent CLI executable | `bin/jcode` |
| `E2B_API_KEY` | (Optional) Managed cloud sandbox provider | None (uses Local Sandbox) |
| `CODESANDBOX_API_KEY` | (Optional) CodeSandbox SDK API Key | None (uses Local Sandbox) |
| `GITHUB_CLIENT_ID` | (Optional) GitHub OAuth App Client ID | Connect via PAT in UI |
| `GITHUB_CLIENT_SECRET` | (Optional) GitHub OAuth App Client Secret | Connect via PAT in UI |
| `ANTHROPIC_API_KEY` | (Optional) Claude API key for `jcode` agent | Built-in autonomous engine |
| `OPENAI_API_KEY` | (Optional) OpenAI API key for `jcode` agent | Built-in autonomous engine |

---

## 🐳 Docker & Docker Compose Deployment

Run with Docker Compose:
```bash
docker compose up -d --build
```
Access the application at `http://localhost:3000`.

### Security Tradeoffs & Sandboxing Architectures
1. **Local Process Sandbox (Default):**
   - Ideal for single-user VPS, developers, and local development.
   - Zero-dependency: works natively across Linux, macOS, and containers without nested virtualization.
2. **Docker-in-Docker (DinD):**
   - Can mount `/var/run/docker.sock` to spawn isolated sibling containers.
   - *Tradeoff:* Granting access to the host Docker daemon gives containerized workloads root privileges over the host.
3. **Managed MicroVM Sandboxes (E2B / Firecracker / CodeSandbox SDK):**
   - For multi-tenant production hosting, set `E2B_API_KEY` or `CODESANDBOX_API_KEY`.
   - Projects execute in isolated microVMs with hardware-level boundary isolation.

---

## ☁️ Deploying to Cloud Platforms

### Fly.io
```bash
fly launch
fly deploy
```

### Railway / Render
1. Connect your GitHub repository.
2. Set build command: `npm install && cd client && npm install && npm run build && cd ..`
3. Set start command: `node server/server.js`
4. Set environment variable `APP_PASSWORD`.

---

## 📂 Project Structure

```
jcode/
├── bin/
│   └── jcode                   # Interactive AI coding agent CLI
├── client/                     # React frontend (Vite + Dark UI)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx       # Chat stream & prompt suggestions
│   │   │   ├── MessageItem.jsx     # Structured cards: Thinking, Tool, Diff, Shell, Error
│   │   │   ├── WorkspacePanel.jsx  # Live Preview iframe, Bolt File Explorer, Git Sync
│   │   │   ├── Sidebar.jsx         # Project sessions, search, user info
│   │   │   ├── SettingsModal.jsx   # GitHub, sandbox, and LLM configuration
│   │   │   └── LoginModal.jsx      # Password gate
│   │   ├── App.jsx             # State management & WebSocket client
│   │   └── index.css           # Modern dark mode theme
│   └── package.json
├── server/
│   ├── auth/
│   │   └── auth-middleware.js  # Password gate & token verification
│   ├── git/
│   │   └── github-service.js   # AES-256 encrypted tokens, Git push, PRs, clone
│   ├── parser/
│   │   └── jcode-parser.js     # Real-time ANSI & event extraction engine
│   ├── pty/
│   │   ├── pty-bridge.py       # True POSIX pseudo-terminal bridge
│   │   └── pty-manager.js      # Cross-environment PTY process manager
│   ├── sandbox/
│   │   └── sandbox-manager.js  # Dev server lifecycle, reverse proxy, HMR, error capture
│   ├── storage/
│   │   ├── file-service.js     # File tree explorer & code editor backend
│   │   └── session-store.js    # Persistent session metadata & chat history
│   └── server.js               # Main Express + WebSocket server
├── test/
│   └── test-all.js             # Automated integration test suite
├── Dockerfile                  # Multi-stage production container
├── docker-compose.yml          # Docker Compose orchestration
└── package.json
```

---

## 📄 License
MIT License. Built with ❤️ for autonomous AI software engineering.
