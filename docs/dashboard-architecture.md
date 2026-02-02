# Dashboard Architecture: CLI vs Web

This document covers the architecture of the two dashboard implementations and critical maintainability considerations.

## Overview

CogCommit has two dashboards with intentionally similar UIs:

| Dashboard | Location | Data Source | Use Case |
|-----------|----------|-------------|----------|
| **CLI Studio** | `apps/cli/src/studio/` | Local SQLite | Offline, fast, full data |
| **Web Dashboard** | `apps/web/app/(dashboard)/` | Supabase (cloud) | Cross-device, sharing |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared Packages                              │
├─────────────────────────────────────────────────────────────────────┤
│  @cogcommit/types     - TypeScript types (CognitiveCommit, etc.)   │
│  @cogcommit/ui        - React components (Header, CommitList, etc.) │
│  @cogcommit/supabase  - Supabase client + transforms                │
└─────────────────────────────────────────────────────────────────────┘
                    │                           │
         ┌──────────┴──────────┐     ┌──────────┴──────────┐
         │    CLI Studio       │     │    Web Dashboard     │
         ├─────────────────────┤     ├─────────────────────┤
         │ apps/cli/src/studio │     │ apps/web/           │
         │                     │     │                     │
         │ Server: Hono        │     │ Server: Next.js     │
         │ Client: React+Vite  │     │ Client: React       │
         │ Data: SQLite        │     │ Data: Supabase      │
         └─────────────────────┘     └─────────────────────┘
```

## Shared Components (@cogcommit/ui)

These components are used by BOTH dashboards and must remain in sync:

| Component | Purpose |
|-----------|---------|
| `Header` | Top bar with project name, stats, project dropdown |
| `CommitList` | Sidebar list of commits |
| `CommitCard` | Individual commit item in list |
| `ConversationViewer` | Main conversation display |
| `TurnView` | Individual turn (user/assistant message) |
| `SidebarHeader` | Collapsible sidebar header with count |
| `useResizable` | Hook for resizable panels |

**Rule**: Any visual change should be made in `@cogcommit/ui` to maintain parity.

## Data Flow Differences

### CLI Studio

```
Local SQLite (data.db)
       │
       ▼
Hono API (/api/commits, /api/project)
       │
       ▼
React Frontend (fetches from localhost:PORT)
       │
       ▼
Shared UI Components
```

- **Data location**: `~/.cogcommit/global/data.db`
- **API**: `apps/cli/src/studio/routes/`
- **Frontend**: `apps/cli/src/studio/frontend/`

### Web Dashboard

```
Supabase (PostgreSQL)
       │
       ▼
Next.js Server Components / API Routes
       │
       ▼
React Client Components
       │
       ▼
Shared UI Components
```

- **Data location**: Supabase cloud database
- **Server**: `apps/web/app/(dashboard)/dashboard/page.tsx`
- **API routes**: `apps/web/app/api/commits/`, `apps/web/app/api/projects/`

---

## CRITICAL: Table Name Gotcha

**This is the #1 source of bugs when working on the web dashboard.**

### The Problem

The Supabase database tables are named:
- `cognitive_commits` (main commits table)
- `sessions` (NOT `cognitive_sessions`)
- `turns` (NOT `cognitive_turns`)

### Why This Matters

The local SQLite uses the same names, but it's easy to assume Supabase uses prefixed names. Multiple bugs have been caused by using `cognitive_sessions` or `cognitive_turns` in queries.

### Correct Supabase Query

```typescript
// CORRECT
const { data } = await supabase
  .from("cognitive_commits")
  .select(`
    *,
    sessions (
      *,
      turns (*)
    )
  `)
  .eq("user_id", user.id);

// WRONG - will silently return null for sessions/turns
const { data } = await supabase
  .from("cognitive_commits")
  .select(`
    *,
    sessions:cognitive_sessions (
      *,
      turns:cognitive_turns (*)
    )
  `);
```

### Reference

Check `apps/cli/src/sync/push.ts` to see the actual table names used:
- Line 173: `.from("sessions").upsert(...)`
- Line 206: `.from("turns")`

---

## Feature Parity Checklist

When adding features, ensure both dashboards are updated:

| Feature | CLI | Web | Notes |
|---------|-----|-----|-------|
| Commit list | ✅ | ✅ | Both use `CommitList` |
| Conversation view | ✅ | ✅ | Both use `ConversationViewer` |
| Project dropdown | ✅ | ✅ | Header prop `isGlobal` + `projects` |
| Sidebar collapse | ✅ | ✅ | Both use `SidebarHeader` |
| Resizable sidebar | ✅ | ✅ | Both use `useResizable` |
| 0-turn filtering | ✅ | ✅ | Filter `turnCount > 0` |
| Commit editing | ✅ | ❌ | CLI has edit/delete, web read-only |
| Real-time updates | ✅ | ❌ | CLI watches filesystem |

## Where They Diverge

### CLI-Only Features

1. **Commit Editing**: CLI has `CommitDetail` with edit/delete
2. **Real-time Watching**: Daemon monitors for new commits
3. **Visual Capture**: Screenshots stored locally
4. **Sync Controls**: Push/pull buttons in UI

### Web-Only Features

1. **OAuth Login**: GitHub authentication
2. **Public Profiles**: (future) Share commits publicly
3. **Team Features**: (future) Shared workspaces

## Transform Functions

Both dashboards use the shared transform from `@cogcommit/supabase`:

```typescript
import { transformCommitWithRelations } from "@cogcommit/supabase";

// Converts DB format (snake_case) to frontend format (camelCase)
// Also sets turnCount from stored prompt_count
const commits = rawData.map(transformCommitWithRelations);
```

**Important**: The `turnCount` uses the stored `prompt_count` column (user prompts only). If `prompt_count` is null (old data), it falls back to computing from sessions.

## Testing Changes

After making changes, verify both dashboards:

```bash
# Build and test web
pnpm build --filter=web
pnpm dev --filter=web
# Visit localhost:3000/dashboard

# Build and test CLI
pnpm build --filter=cogcommit
cd some-project && cogcommit studio
# or for global: cogcommit studio --global
```

## Common Mistakes

1. **Wrong table names**: Using `cognitive_sessions` instead of `sessions`
2. **Missing turnCount**: Filtering by turnCount without computing it
3. **UI changes in wrong place**: Editing web-specific code instead of shared `@cogcommit/ui`
4. **Forgetting API routes**: Web has `/api/commits` and `/api/projects` for lazy loading
5. **Different data shapes**: CLI API returns camelCase, web returns snake_case that needs transform

## File Reference

### Shared (modify for both)
- `packages/ui/src/` - All shared components
- `packages/types/src/index.ts` - Type definitions
- `packages/supabase/src/transforms.ts` - Data transformations

### CLI-Specific
- `apps/cli/src/studio/frontend/App.tsx` - Main CLI dashboard
- `apps/cli/src/studio/routes/` - Local API endpoints
- `apps/cli/src/storage/db.ts` - SQLite queries

### Web-Specific
- `apps/web/app/(dashboard)/dashboard/page.tsx` - Dashboard page
- `apps/web/components/DashboardClient.tsx` - Dashboard client component
- `apps/web/app/api/commits/route.ts` - Commits API
- `apps/web/app/api/projects/route.ts` - Projects API
