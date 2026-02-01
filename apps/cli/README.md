# CogCommit CLI

The command-line interface for CogCommit.

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Building

```bash
# From repo root
pnpm build --filter=cogcommit

# Or from this directory
pnpm build
```

This runs two build steps:
1. `tsc` - Compiles TypeScript to `dist/`
2. `vite build` - Bundles the Studio frontend to `dist/studio/`

### Running Locally

```bash
# Run CLI directly
node dist/index.js --help

# Or use pnpm dev from repo root
pnpm dev --filter=cogcommit
```

### Testing the Studio Dashboard

```bash
# Import some data first
node dist/index.js import

# Start the dashboard
node dist/index.js dashboard
```

## Architecture

```
src/
├── index.ts              # CLI entry point
├── commands/             # Command modules (Commander.js)
│   ├── parse.ts          # parse, list, info commands
│   ├── init.ts           # init command
│   ├── watch.ts          # watch, stop, status, capture
│   ├── studio.ts         # dashboard command
│   ├── import.ts         # import command
│   ├── auth.ts           # login, logout, whoami
│   ├── sync.ts           # push, pull, sync
│   └── config.ts         # config, analytics
├── parser/               # JSONL log parsing
├── storage/              # SQLite database
│   ├── db.ts             # Database wrapper
│   ├── schema.ts         # Schema & migrations
│   └── repositories/     # Data access layer
├── sync/                 # Cloud sync (push/pull)
├── studio/               # Local dashboard (React + Hono)
│   ├── server.ts         # Hono API server
│   └── frontend/         # React app (bundled by Vite)
├── daemon/               # Background watcher
├── config/               # Configuration paths
├── models/               # Type definitions
└── utils/                # Utility functions (title generation, etc.)
```

## Database API

Uses the repository pattern for data access:

```typescript
const db = new CogCommitDB(projectPath);

// Commits
db.commits.get(id);
db.commits.getAll();
db.commits.insert(commit);
db.commits.update(id, { title: "New title" });
db.commits.delete(id);

// Sessions & Turns
db.sessions.getForCommit(commitId);
db.turns.getForSession(sessionId);

// Visuals
db.visuals.create(commitId, "screenshot", filePath);
db.visuals.getForCommit(commitId);

// Daemon State
db.daemonState.getLastActivity();
db.daemonState.getCurrentCommitId();
db.daemonState.setFilePosition(filePath, position);
```

## Cloud Sync Commands

### Push Options

```bash
# Push with progress bar (default)
cogcommit push

# Verbose mode (shows each commit, disables progress bar)
cogcommit push --verbose

# Preview what would be pushed
cogcommit push --dry-run

# Force re-push all commits (resets sync status)
cogcommit push --force

# Retry previously failed commits
cogcommit push --retry
```

### Cloud Management

```bash
# Delete all your cloud data (requires confirmation)
cogcommit cloud clear

# Skip confirmation (for scripts)
cogcommit cloud clear --yes
```

## Publishing

```bash
# Build and publish to npm
pnpm build
npm publish
```

The package is published as `cogcommit` on npm.
