---
description: Index codebase into Agent Replay for persistent local context
allowed-tools: ["Read", "Glob", "Grep", "Bash", "Bash(node:*)", "Task"]
---

# Codebase Indexing

Analyze this codebase and save findings to Agent Replay's local memory using the memory-store script.

## Phase 1: Project Overview

Read:
- `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod`
- `README.md`
- Config files (tsconfig, eslint, etc.)

Collect: project name, purpose, tech stack, build/run/test commands

**Save immediately:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Project Overview: [name], [purpose], [tech stack], [build/run commands]"
```

## Phase 2: Architecture

Explore:
- Use Glob for folder structure
- Find entry points (index.ts, main.py, App.tsx)
- Identify API routes, database models

Collect: architecture overview, key modules, data flow

**Save immediately:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Architecture: [folder structure], [entry points], [key modules], [data flow]"
```

## Phase 3: Conventions

Analyze:
- Naming conventions
- File organization patterns
- Import patterns
- Recent commits: `git log --oneline -20`

Collect: coding style, patterns to follow

**Save immediately:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Conventions: [naming], [file organization], [import patterns], [commit style]"
```

## Phase 4: Key Components

Read:
- Auth logic
- Database connections
- API clients
- Shared utilities

Collect: where important logic lives

**Save immediately:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Key Components: [auth], [database], [api clients], [utilities] with file paths"
```

## Important

- Use the `add-memory.cjs` script for EVERY phase — do not skip saving
- Each call stores content into Agent Replay's local vector memory
- Keep each memory focused and under 2000 characters
- Include file paths and concrete details, not vague descriptions
- The script uses `$CLAUDE_PLUGIN_ROOT` to locate itself automatically
