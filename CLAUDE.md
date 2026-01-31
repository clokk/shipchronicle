# Agentlogs

Parses Claude Code session logs into **Cognitive Commits** — the unit of work between git commits, showing the conversation that shaped the code.

## Architecture

Three-layer design:

| Layer | Location | Purpose |
|-------|----------|---------|
| Parser | `src/parser/` | Reads JSONL logs from `~/.claude/projects/`, extracts cognitive commits via state machine |
| Storage | `src/storage/` | SQLite with migrations (currently v3), supports global and project modes |
| Studio | `src/studio/` | React frontend + Hono API for browsing and curating commits |

## Data Model

### CognitiveCommit

```typescript
{
  id: string;              // UUID
  gitHash: string | null;  // Links to git commit (if closed by commit)
  closedBy: "git_commit" | "session_end" | "explicit";
  startedAt: Date;
  closedAt: Date;
  sessions: Session[];     // Supports parallel Claude sessions
  parallel: boolean;       // True if sessions overlapped
  filesRead: string[];     // Paths only
  filesChanged: string[];  // Paths with diffs
}
```

### Commit Closure

A cognitive commit closes when:
1. **Git commit** — Natural boundary, links directly to hash
2. **Session end** — Work done but uncommitted (exploratory, abandoned)
3. **Explicit close** — User manually marks boundary

### Storage Paths

- **Global mode**: `~/.agentlogs/chronicle.db` — all projects in one DB
- **Project mode**: `.agentlogs/chronicle.db` — project-scoped (requires `init`)

---

## Critical: Flexbox Scroll Bug

**This is the most common issue when working on Studio UI.**

Flexbox layouts with `overflow-y-auto` children won't create independent scroll contexts if the root can expand. The whole page scrolls instead of individual panels.

### Root Cause

Using `min-h-screen` on the root allows content to expand beyond viewport, causing page-level scroll instead of panel-level scroll.

### The Fix

```tsx
// Root - fixed to viewport, no page scroll
<div className="h-screen bg-bg flex flex-col overflow-hidden">
  <Header />
  <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
    {/* Left panel - independent scroll */}
    <div className="w-96 overflow-y-auto">...</div>
    {/* Right panel */}
    <div className="flex-1 overflow-hidden">
      <DetailView /> {/* Must use h-full */}
    </div>
  </div>
</div>
```

**Key rules:**
- Root: `h-screen overflow-hidden` (NOT `min-h-screen`)
- Flex containers: `style={{ minHeight: 0 }}` to allow children to shrink
- Scroll containers: `style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/parser/extractor.ts` | Core parsing state machine — extracts commits from log entries |
| `src/parser/types.ts` | Log entry type definitions matching Claude Code JSONL format |
| `src/storage/schema.ts` | Database schema + migrations (check `SCHEMA_VERSION`) |
| `src/storage/db.ts` | Database operations, handles global vs project mode |
| `src/studio/frontend/App.tsx` | Main React app layout with split pane |
| `src/studio/frontend/components/CommitDetail.tsx` | Detail view — careful with scroll handling |
| `src/studio/frontend/components/CommitList.tsx` | Left sidebar commit list |
| `src/studio/server.ts` | Hono API server |
| `src/index.ts` | CLI entry point with all commands |
| `docs/style-guide.md` | Design system + known UI fixes |
| `docs/vision.md` | Full product roadmap and architecture decisions |

---

## Design System

### Colors

| Token | Usage |
|-------|-------|
| `--chronicle-blue` | Primary action, links, current selection |
| `--chronicle-green` | Git hashes, success states, committed work |
| `--chronicle-amber` | File changed indicators, uncommitted work |
| `--chronicle-purple` | Parallel session indicators |

### Fonts

| Font | Usage |
|------|-------|
| **Inter** | UI text, conversation content |
| **JetBrains Mono** | Git hashes, file paths, code, timestamps |

### Patterns

- Committed commits: `border-chronicle-green`
- Uncommitted work: `border-chronicle-amber`
- User messages: `bg-chronicle-blue/5 border-l-2 border-chronicle-blue`
- Assistant messages: `bg-panel`
