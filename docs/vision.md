# Agentlogs

> A repository for your agent conversations.

## The Problem

You have valuable conversations with AI coding agents every day. Where do they go?

They disappear into `~/.claude/projects/` — scattered JSONL files that become impossible to search, reference, or learn from. The conversation that shaped your code is lost the moment the session ends.

Git tracks *what* changed. Nothing tracks *how it got built*.

## The Solution

Agentlogs extracts your Claude Code conversations and stores them in a searchable repository, linked to the git commits they produced.

```
agentlogs import    # Import all Claude Code history
agentlogs studio    # Browse your conversations
```

That's it. Parse, store, browse.

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

## Future Possibilities

These are ideas, not commitments. The core value is the repository.

### Near-term
- Full-text search across all conversations
- Export to markdown/JSON
- Better diff visualization
- Session labels and tags

### Further out
- Public sharing (opt-in chronicles)
- Screenshot capture for visual context
- Team/org mode
- Support for other agents (Cursor, Copilot, etc.)

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

SQLite with migrations. Current version: v3.

Tables: `projects`, `cognitive_commits`, `sessions`, `turns`

Indices on: git hash, timestamps, project ID

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
