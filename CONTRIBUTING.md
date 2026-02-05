# Contributing to Agent Replay Claude Plugin

Thank you for your interest in contributing! This document provides guidelines for contributing to the Agent Replay plugin for Claude Code.

## Getting Started

### Prerequisites

- Node.js 18+
- Claude Code 1.0.33+
- Agent Replay server (for testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/agentreplay/agentreplay-claude-plugin.git
cd agentreplay-claude-plugin

# Test locally with Claude Code
claude --plugin-dir .
```

## Project Structure

```
agentreplay-claude-plugin/
├── .claude-plugin/plugin.json   # Plugin manifest
├── hooks/hooks.json             # Hook definitions
├── commands/                    # Slash commands (Markdown)
├── skills/                      # Agent skills (Markdown)
├── scripts/                     # Hook handlers (JavaScript)
└── README.md
```

## Making Changes

### Commands

Commands are Markdown files in `commands/`. Each command needs YAML frontmatter:

```markdown
---
description: Brief description of what the command does
allowed-tools: ["Bash", "Read"]  # Optional: tools the command can use
---

# Command Name

Instructions for Claude...
```

### Skills

Skills are in `skills/<skill-name>/SKILL.md`. Skills are auto-invoked by Claude based on context:

```markdown
---
name: skill-name
description: When to use this skill
allowed-tools: Bash(node:*)
---

# Skill Instructions

How to perform the skill...
```

### Hook Scripts

Hook scripts are bundled JavaScript in `scripts/`. If you need to modify them:

1. Edit the source in the SDK repository
2. Rebuild with esbuild
3. Copy the `.cjs` files here

### Testing

```bash
# Load plugin in Claude Code
claude --plugin-dir .

# Test commands
/agentreplay:status
/agentreplay:index

# Test hooks by observing behavior during normal usage
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with Claude Code
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

### PR Guidelines

- Keep changes focused and atomic
- Update README if adding new features
- Include testing instructions
- Describe the problem and solution

## Code Style

- Markdown: Use proper headings and formatting
- JavaScript: Follow existing patterns in scripts
- YAML frontmatter: Keep it minimal and accurate

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions

Thank you for contributing!
