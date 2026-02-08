---
name: memory-store
description: Store knowledge, code findings, conventions, or any text into Agent Replay's local memory. All data stays on your machine.
allowed-tools: Bash(node:*)
---

# Memory Store

Save information to Agent Replay's local memory for later retrieval.

## Store Command

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "CONTENT_TO_STORE"
```

## Guidelines

- Store one focused piece of knowledge per call
- Keep content concise but informative (under 2000 chars)
- Include context: what it is, where it applies, why it matters

## Examples

**Save a convention:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Convention: This project uses camelCase for variables and PascalCase for types. Files are organized by feature, not by type."
```

**Save architecture info:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Architecture: The server uses Axum with embedded HNSW vector index. API routes are in server.rs, memory endpoints in memory.rs. Port 47100."
```

**Save a finding:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add-memory.cjs" "Key file: src/server.rs handles all HTTP routes. The trace query logic starts at the query_traces function. Project ID 49455 is reserved for Claude Code."
```

## Output

The script confirms storage with document ID. Data is saved locally and searchable via the memory-search skill.

## Privacy

All data stays on your machine - no external servers involved.
