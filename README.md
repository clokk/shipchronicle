# Agentlogs

> A repository for your agent conversations.

Parse Claude Code session logs to extract **Cognitive Commits** — the work that happens between git commits, including the conversation that shaped it.

## Installation

```bash
npm install
npm run build
npm run build:studio  # Build the web UI
```

## Quick Start

```bash
# Import all your Claude Code history
agentlogs import

# Open the studio to browse conversations
agentlogs studio
```

That's it! No setup required. Global mode is now the default.

**Or focus on a single project:**

```bash
# Initialize for project-specific mode (needed for daemon/capture)
cd your-project
agentlogs init

# Import only this project
agentlogs import --project

# View only this project
agentlogs studio --project
```

## Global Mode (Default)

Global mode is the default. It lets you explore your entire Claude Code history across all projects in one view.

### Features

- **Project filtering** - Filter commits by project using the dropdown in the header
- **Project badges** - Each commit shows a color-coded badge indicating which project it belongs to
- **Unified timeline** - See all your Claude work in one chronological view
- **Per-project stats** - Dropdown shows commit counts per project

### Usage

```bash
# Import all Claude Code projects (default behavior)
agentlogs import

# Re-import with fresh data (clears existing)
agentlogs import --clear

# Open the studio (global view is default)
agentlogs studio
```

### How It Works

1. Discovers all Claude Code projects in `~/.claude/projects/`
2. Parses session files from each project
3. Tags each cognitive commit with its source project name
4. Stores everything in a unified database at `~/.agentlogs/global/`

## Commands

### Web Studio (Phase 3)

```bash
# Start the web-based curation studio (global view, default)
agentlogs studio                 # Opens http://localhost:4747

# View only current project (requires init)
agentlogs studio --project

# Custom port
agentlogs studio --port 3000

# Don't auto-open browser
agentlogs studio --no-open
```

### Import Sessions

```bash
# Import all Claude Code projects (default)
agentlogs import

# Import only current project (requires init)
agentlogs import --project

# Clear existing data before importing
agentlogs import --clear

# Import from specific Claude project
agentlogs import --claude-path ~/.claude/projects/-Users-you-project
```

### Watch Daemon (Phase 2)

The daemon enables real-time capture of sessions and screenshots. Requires initialization.

```bash
# Initialize for a project (required for daemon and --project mode)
agentlogs init

# Start watching for Claude sessions (runs in background)
agentlogs watch

# Run in foreground with verbose output
agentlogs watch --foreground --verbose

# Check daemon status and statistics
agentlogs status

# Stop the daemon
agentlogs stop

# Manually capture a screenshot
agentlogs capture

# Capture specific URL
agentlogs capture --url http://localhost:3000
```

### Parser CLI (Phase 1)

```bash
# List discovered Claude projects
agentlogs list

# Parse a project
agentlogs parse ~/.claude/projects/-Users-you-YourProject/

# Parse specific session
agentlogs parse <path> -s <session-id>

# Output formats: pretty (default), json, summary
agentlogs parse <path> -o json
```

## What is a Cognitive Commit?

The **Cognitive Commit** is the new unit of work. It captures everything between git commits:

| Git | Cognitive Commit |
|-----|------------------|
| Many file changes → one commit | Many turns → one cognitive commit |
| Commit message = summary | First prompt = intent |
| `git diff` shows what changed | Turns show how it evolved |

**What closes a Cognitive Commit:**
1. **Git commit** - links directly to a hash
2. **Session end** - work done but not committed
3. **Explicit close** - user manually marks boundary

## Studio Interface

The web studio provides a split-view interface:

```
┌─────────────────────────────────────────────────────────────┐
│  Studio: All Claude History  [▼ All Projects]    [Publish]  │
├────────────────────────┬────────────────────────────────────┤
│  COMMIT LIST (scroll)  │  DETAIL (fixed header)             │
│  ┌──────────────────┐  │  ┌──────────────────────────────┐  │
│  │ 🟣 claudeverse   │  │  │ [abc123] · claudeverse       │  │
│  │ ☑ [abc123]       │  │  │ "Add auth flow"    [Publish] │  │
│  │   "Add auth..."  │  │  │ 12 turns · 3 files · Jan 15  │  │
│  │   12 turns       │  │  ├──────────────────────────────┤  │
│  ├──────────────────┤  │  │ CONVERSATION (scroll)        │  │
│  │ 🟢 Soteria       │  │  │ ┌──────────────────────────┐ │  │
│  │ ☐ [def456]       │  │  │ │ 👤 User message...       │ │  │
│  │   "Fix bug"      │  │  │ │ 🤖 Assistant response... │ │  │
│  └──────────────────┘  │  │ └──────────────────────────┘ │  │
└────────────────────────┴────────────────────────────────────┘
```

**Features:**
- Independent scroll for commit list and conversation
- Fixed header with title, stats, and actions
- Color-coded project badges (consistent colors per project)
- Bulk selection and publishing
- Inline title editing

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║  AGENTLOGS: myproject                                      ║
╚════════════════════════════════════════════════════════════╝

📊 Summary
   Cognitive Commits: 3
   Sessions Parsed: 1
   Total Turns: 305

📝 Cognitive Commits

   1. [5ab1b76]
      Closed by: git_commit
      Time: 03:01 AM → 03:38 AM
      Sessions: 1 (152 turns)
      Files changed: 11
```

## How It Works

When the daemon is running, it:

1. **Monitors** Claude Code session files (`.jsonl`) for changes
2. **Detects** git commits in the conversation
3. **Captures** screenshots of your dev server automatically
4. **Persists** cognitive commits to SQLite for later retrieval

Data is stored in:
- Project mode: `~/.agentlogs/<project-hash>/`
- Global mode: `~/.agentlogs/global/`

Each contains:
- `data.db` - SQLite database with commits, sessions, turns
- `screenshots/` - Auto-captured and manual screenshots

## Database Schema

The database uses migrations to evolve the schema:

- **v1**: Base schema (commits, sessions, turns, visuals)
- **v2**: Curation fields (published, hidden, title, display_order)
- **v3**: Global mode support (project_name column for filtering)

## Roadmap

- **Phase 1:** Parser CLI ✓
- **Phase 2:** Watch daemon + auto-capture screenshots ✓
- **Phase 3:** Web studio for curation ✓
- **Phase 4:** Public viewer at agentlogs.dev

See [docs/vision.md](docs/vision.md) for the full vision.

## License

MIT
