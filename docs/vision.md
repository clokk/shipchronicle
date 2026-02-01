# Agentlogs

> Git for your agent conversations. GitHub for syncing them everywhere.

## The Problem

You have valuable conversations with AI coding agents every day. Where do they go?

They disappear into `~/.claude/projects/` — scattered JSONL files that become impossible to search, reference, or learn from. The conversation that shaped your code is lost the moment the session ends.

Git tracks *what* changed. Nothing tracks *how it got built*.

## The Solution

Agentlogs is a **repository for your agent conversations** — like git is for code.

- **Local-first**: Your conversations are stored locally in SQLite, always accessible
- **Cloud-synced**: Push to the cloud to access from any machine (like pushing to GitHub)
- **Linked to code**: Conversations are tied to the git commits they produced

```
agentlogs import    # Import all Claude Code history
agentlogs studio    # Browse your conversations
agentlogs push      # Sync to cloud
```

### The Git/GitHub Model

| Git | Agentlogs |
|-----|-----------|
| `git init` | `agentlogs init` |
| `git add` + `git commit` | Automatic: daemon captures conversations |
| `git log` | `agentlogs studio` |
| `git push` | `agentlogs push` |
| `git pull` | `agentlogs pull` |
| GitHub | Agentlogs Cloud |

Your conversations live locally first. Cloud sync is optional but powerful — access your full history from any machine, share chronicles publicly, and never lose context.

## The Data Model

### Cognitive Commit

The unit of work between git commits:

```
CognitiveCommit
├── id
├── gitHash (nullable)     # Links to git commit if one was made
├── closedBy               # "git_commit" | "session_end"
├── startedAt / closedAt
├── sessions[]             # One or more Claude sessions
├── filesRead[]            # Paths referenced
└── filesChanged[]         # Paths with diffs
```

A cognitive commit closes when:
1. **Git commit** — Natural boundary, links directly to hash
2. **Session end** — Work done but uncommitted

### Why "Cognitive Commit"?

| Git Commit | Cognitive Commit |
|------------|------------------|
| Many file changes → one commit | Many conversation turns → one cognitive commit |
| Commit message = summary | Conversation = full context |
| `git diff` shows what changed | Turns show how it evolved |
| `git log` shows history | Timeline of cognitive commits |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Parser    │ →   │   Storage   │ →   │   Studio    │
│             │     │             │     │             │
│ Reads JSONL │     │   SQLite    │     │  React UI   │
│ from Claude │     │   + API     │     │  to browse  │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Global mode (default):** All projects in one database at `~/.agentlogs/`

**Project mode:** Scoped to single project at `.agentlogs/`

## CLI

```bash
# Import Claude Code history
agentlogs import             # All projects (global)
agentlogs import --project   # Current project only

# Browse conversations
agentlogs studio             # Open web UI

# Utilities
agentlogs list               # Show available projects
agentlogs status             # Show database stats
```

## What Gets Stored

| Data | Stored |
|------|--------|
| User prompts | ✓ |
| Assistant responses | ✓ |
| Tool calls (edits, reads, bash) | ✓ |
| File diffs | ✓ |
| Git commit hashes | ✓ |
| Timestamps | ✓ |

## Who This Is For

Anyone who uses Claude Code and wants to:
- **Search** past conversations ("How did I implement auth last month?")
- **Learn** from your own collaboration patterns
- **Reference** the thinking behind code decisions
- **Build** a record of your AI-assisted work

---

## Current Features

### Core
- Parse Claude Code session logs into cognitive commits
- SQLite storage with full conversation history
- Studio UI for browsing and curating conversations
- Screenshot capture for visual context
- Multi-agent support (Claude Code, Cursor, Antigravity, Codex, OpenCode)

### Cloud Sync
- `agentlogs login` — GitHub OAuth authentication
- `agentlogs push` / `agentlogs pull` — Manual sync
- Continuous sync — Background sync daemon
- Cross-machine access — Your conversations anywhere

## Future Possibilities

These are ideas, not commitments. The core value is the repository.

### Near-term
- Full-text search across all conversations
- Better diff visualization
- Session labels and tags
- Conflict resolution UI

### Further out
- Public sharing (opt-in chronicles)
- Team/org mode with shared repositories
- End-to-end encryption option
- Aggregate analytics (opt-in)

### Someday/maybe
- Live rebuild of product state at each commit
- Comparison view between commits
- Integration with Agent Trace standard
- Hiring/assessment use case

---

## Technical Details

### Claude Code Log Format

**Location:** `~/.claude/projects/<project-path>/<session-uuid>.jsonl`

Each line is a JSON object with:
- `type`: "user", "assistant", "summary"
- `message`: Content with role, tool calls, timestamps
- `uuid`/`parentUuid`: Session threading

**Retention:** Files persist ~3 weeks. Import regularly.

### Storage Schema

SQLite with migrations. Current version: v6.

**Local tables:** `cognitive_commits`, `sessions`, `turns`, `visuals`, `daemon_state`

**Sync columns (v6):** `cloud_id`, `sync_status`, `cloud_version`, `local_version`, `last_synced_at`

Indices on: git hash, timestamps, project name, sync status

### Key Files

| File | Purpose |
|------|---------|
| `src/parser/extractor.ts` | Core parsing state machine |
| `src/storage/db.ts` | Database operations |
| `src/studio/frontend/App.tsx` | Main UI |
| `src/index.ts` | CLI entry point |

---

## The Name

**Agentlogs** — logs from your AI agents.

- Clear and descriptive
- Developer-friendly (.dev domain)
- Works as noun: "Check my agentlogs"
