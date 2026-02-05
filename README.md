# Agent Replay Plugin for Claude Code

<p align="center">
  <strong>🔍 Observability Tracing + 🧠 Persistent Memory for Claude Code</strong>
</p>

<p align="center">
  <a href="https://agentreplay.dev">Website</a> •
  <a href="https://github.com/agentreplay/agentreplay-claude-plugin">GitHub</a> •
  <a href="https://docs.agentreplay.dev">Documentation</a>
</p>

---

Agent Replay is a **local-first** plugin that enhances Claude Code with two powerful capabilities:

1. **Observability Tracing**: Automatically captures every tool call, session, and agent activity for debugging and analysis
2. **Persistent Memory**: Remembers context across sessions so Claude knows what you worked on before

All data stays on your machine. No cloud accounts. No API keys. Full privacy.

## Why Agent Replay?

Without Agent Replay, every Claude Code session starts fresh. Claude doesn't remember:
- What you built yesterday
- Your coding preferences
- Project architecture decisions
- Past debugging sessions

With Agent Replay, Claude automatically recalls relevant context from previous sessions, making it more effective at helping you code.

## Features

### 🔍 Observability Tracing

- **Session tracking**: Every session gets a unique trace ID
- **Tool call capture**: Records all tool invocations with inputs, outputs, and timing
- **Error tracking**: Captures failures for debugging
- **Timeline view**: See exactly what Claude did in the Agent Replay UI

### 🧠 Persistent Memory

- **Automatic context injection**: Relevant memories loaded at session start
- **Conversation persistence**: Key information saved when sessions end
- **Semantic search**: Find past work using natural language
- **Project-scoped**: Memories organized by workspace/project

### 🏠 Local-First

- **No cloud dependency**: Everything runs on your machine
- **No accounts required**: Just install and use
- **Full data control**: Delete anytime, export anywhere
- **Works offline**: No internet needed after setup

## Installation

### Prerequisites

1. **Claude Code** version 1.0.33 or later
   ```bash
   claude --version
   ```

2. **Agent Replay** server running locally
   - Download from [agentreplay.dev](https://agentreplay.dev)
   - Or run from source: `cd agentreplay && cargo run`
   - Default endpoint: `http://localhost:47100`

3. **Node.js** 18 or later (for hook scripts)

### Install the Plugin

**Option 1: From GitHub (Recommended)**

```bash
# Add the marketplace
/plugin marketplace add agentreplay/agentreplay-claude-plugin

# Install the plugin
/plugin install agentreplay
```

**Option 2: Local Directory**

```bash
# Clone the repository
git clone https://github.com/agentreplay/agentreplay-claude-plugin.git

# Add as local marketplace
/plugin marketplace add ./agentreplay-claude-plugin

# Install
/plugin install agentreplay
```

**Option 3: Manual Copy**

```bash
# Clone and copy to Claude plugins directory
git clone https://github.com/agentreplay/agentreplay-claude-plugin.git
cp -r agentreplay-claude-plugin ~/.claude/plugins/agentreplay
```

### Verify Installation

```bash
# Start Claude Code
claude

# Check plugin is loaded
/help
# You should see /agentreplay:* commands listed
```

## Usage

### Automatic Features (No Action Needed)

Once installed, the plugin works automatically:

| Event | What Happens |
|-------|--------------|
| **Session Start** | Queries memory, injects relevant context, creates trace span |
| **Tool Use** | Records tool name, inputs, outputs, timing |
| **Session End** | Saves conversation summary, closes trace span |

### Commands

| Command | Description |
|---------|-------------|
| `/agentreplay:index` | Index your codebase into memory (architecture, conventions, key files) |
| `/agentreplay:status` | Check Agent Replay server connection and memory statistics |
| `/agentreplay:clear` | Reset plugin settings to defaults |

### Skills (Auto-Invoked)

| Skill | Triggered When |
|-------|----------------|
| `memory-search` | You ask about past work, previous sessions, or want to recall information |

### Example Session

```
You: /agentreplay:status

Agent Replay Status: ✅ Running
Endpoint: http://localhost:47100
Memory:
- Vectors: 1,234
- Documents: 89
- Storage: 45.2 MB

---

You: What did I work on yesterday?

[memory-search skill auto-invoked]

Based on your memory, yesterday you:
- Fixed the authentication bug in auth.ts
- Refactored the database connection pool
- Added unit tests for the user service

---

You: /agentreplay:index

[Analyzing codebase...]
- Found: TypeScript project with Express backend
- Key files: src/index.ts, src/routes/*, src/models/*
- Conventions: camelCase, async/await, Jest for testing
- Saved to memory ✓
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTREPLAY_URL` | `http://localhost:47100` | Agent Replay server endpoint |
| `AGENTREPLAY_TENANT_ID` | `1` | Multi-tenant ID (for enterprise) |
| `AGENTREPLAY_PROJECT_ID` | `1` | Project scope ID |
| `AGENTREPLAY_TRACING` | `true` | Enable/disable tracing |
| `AGENTREPLAY_MEMORY` | `true` | Enable/disable memory |
| `AGENTREPLAY_DEBUG` | `false` | Enable verbose logging |

### Config File

Create `~/.agentreplay-claude/config.json`:

```json
{
  "serverUrl": "http://localhost:47100",
  "tenantId": 1,
  "projectId": 1,
  "tracingEnabled": true,
  "memoryEnabled": true,
  "verbose": false,
  "contextLimit": 5,
  "ignoredTools": ["Read", "Glob", "Grep", "TodoWrite", "LS"]
}
```

| Option | Type | Description |
|--------|------|-------------|
| `serverUrl` | string | Agent Replay server URL |
| `tenantId` | number | Tenant ID for multi-tenant setups |
| `projectId` | number | Project ID for scoping |
| `tracingEnabled` | boolean | Toggle observability tracing |
| `memoryEnabled` | boolean | Toggle memory features |
| `verbose` | boolean | Enable debug logging to stderr |
| `contextLimit` | number | Max memories to inject per session |
| `ignoredTools` | array | Tools to skip when tracing |

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                            │
├─────────────────────────────────────────────────────────────┤
│  SessionStart  │  PreToolUse  │  PostToolUse  │    Stop     │
│      Hook      │     Hook     │     Hook      │    Hook     │
└───────┬────────┴──────┬───────┴───────┬───────┴──────┬──────┘
        │               │               │              │
        ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Agent Replay Plugin                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Tracing   │  │   Memory    │  │   Context Builder   │  │
│  │   Module    │  │   Module    │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Replay Server (localhost:47100)          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  /traces    │  │  /memory    │  │   Vector Database   │  │
│  │    API      │  │    API      │  │      (Local)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Hook Lifecycle

1. **SessionStart**: 
   - Create root trace span
   - Query memory for relevant context
   - Inject context into Claude's system prompt

2. **PreToolUse**:
   - Record tool start timestamp

3. **PostToolUse**:
   - Calculate tool duration
   - Send trace with input/output
   - Skip ignored tools (Read, Glob, etc.)

4. **Stop**:
   - Extract new conversation content
   - Save to memory with metadata
   - Close trace span

### Memory Storage

Memories are stored per-workspace using a hash of the directory path:

```
Workspace: /Users/you/projects/my-app
Memory Collection: ws_my_app_a1b2c3d4e5f6
```

This ensures:
- Project isolation (memories don't leak across projects)
- Consistent identification (same folder = same memories)
- Human-readable prefixes for debugging

## Plugin Structure

```
agentreplay-claude-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── hooks/
│   └── hooks.json            # Hook definitions
├── commands/
│   ├── index.md              # /agentreplay:index command
│   ├── status.md             # /agentreplay:status command
│   └── clear.md              # /agentreplay:clear command
├── skills/
│   └── memory-search/
│       └── SKILL.md          # Memory search skill
├── scripts/
│   ├── session-start.cjs     # SessionStart hook handler
│   ├── stop.cjs              # Stop hook handler
│   ├── pre-tool.cjs          # PreToolUse hook handler
│   ├── post-tool.cjs         # PostToolUse hook handler
│   ├── prompt.cjs            # UserPromptSubmit hook handler
│   ├── search-memory.cjs     # Memory search CLI
│   └── add-memory.cjs        # Memory add CLI
└── README.md
```

## Troubleshooting

### Plugin not loading

```bash
# Verify plugin structure
ls -la ~/.claude/plugins/agentreplay/.claude-plugin/

# Should show: plugin.json
```

### Agent Replay server not reachable

```bash
# Check if server is running
curl http://localhost:47100/api/v1/health

# If not running, start Agent Replay
open /Applications/Agent\ Replay.app  # macOS
# or
./agentreplay                         # from source
```

### No memories being saved

```bash
# Enable debug logging
export AGENTREPLAY_DEBUG=true

# Check logs during session for errors
```

### Context not injecting

1. Check server is running (`/agentreplay:status`)
2. Verify memories exist for this workspace
3. Check `memoryEnabled` is `true` in config

### Hooks timing out

Increase timeout in `hooks/hooks.json`:

```json
{
  "type": "command",
  "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.cjs",
  "timeout": 60  // Increase from 30
}
```

## Privacy & Security

- **100% Local**: All data stored on your machine via Agent Replay
- **No Telemetry**: No data sent to external servers
- **No Accounts**: No signup, login, or API keys required
- **Full Control**: Delete `~/.agentreplay-claude/` to remove all plugin data
- **Open Source**: Audit the code yourself

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone
git clone https://github.com/agentreplay/agentreplay-claude-plugin.git
cd agentreplay-claude-plugin

# Test locally
claude --plugin-dir .

# Make changes to commands/, skills/, or scripts/
# Test your changes
# Submit PR
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **Website**: [agentreplay.dev](https://agentreplay.dev)
- **Documentation**: [docs.agentreplay.dev](https://docs.agentreplay.dev)
- **GitHub**: [github.com/agentreplay](https://github.com/agentreplay)
- **Agent Replay Server**: [github.com/agentreplay/agentreplay](https://github.com/agentreplay/agentreplay)

---

<p align="center">
  Built with ❤️ by the Agent Replay team
</p>
