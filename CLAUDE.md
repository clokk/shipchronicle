# CogCommit

Document your AI-assisted development with **Cognitive Commits** — the unit of work between git commits, showing the conversation that shaped the code.

## Architecture

Monorepo structure with shared packages:

```
cogcommit/
├── apps/
│   ├── cli/                    # CLI tool (cogcommit command)
│   │   └── src/
│   │       ├── index.ts        # CLI entry point
│   │       ├── parser/         # JSONL log parsing
│   │       ├── storage/        # SQLite with better-sqlite3
│   │       ├── sync/           # Cloud sync (push/pull)
│   │       ├── studio/         # Local dashboard (React + Hono)
│   │       └── config/         # Config paths (~/.cogcommit/)
│   │
│   └── web/                    # Next.js web platform (cogcommit.com)
│       └── app/
│           ├── (marketing)/    # Landing, features, docs
│           ├── (dashboard)/    # Authenticated commit browser
│           └── (auth)/         # Login, OAuth callback
│
├── packages/
│   ├── types/                  # @cogcommit/types - shared TypeScript types
│   ├── supabase/               # @cogcommit/supabase - client & queries
│   └── ui/                     # @cogcommit/ui - shared React components
│
└── docs/                       # Documentation
```

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
  source: ConversationSource; // Agent that produced the conversation
  // Public sharing
  publicSlug?: string;     // URL slug for public access (e.g., "abc12345")
  publishedAt?: string;    // When the commit was published
  published?: boolean;     // Whether the commit is publicly accessible
}

// Supported sources (currently only claude_code is implemented)
type ConversationSource = "claude_code" | "cursor" | "antigravity" | "codex" | "opencode";
```

### Commit Closure

A cognitive commit closes when:
1. **Git commit** — Natural boundary, links directly to hash
2. **Session end** — Work done but uncommitted (exploratory, abandoned)
3. **Explicit close** — User manually marks boundary

### Public Sharing

Commits can be published to make them publicly accessible via shareable links:

- **URL format**: `/c/[slug]` (e.g., `/c/abc12345`)
- **Privacy**: All commits are private by default; explicit publish action required
- **Slug persistence**: Unpublishing preserves the slug, so re-publishing restores the same URL
- **Author info**: Public pages show author username (falls back to "Anonymous" if RLS blocks)

### Public Profiles

Users with public commits have public profile pages:

- **URL format**: `/u/[username]` (e.g., `/u/octocat`)
- **Content**: Avatar, username, public commit count, and grid of public commits
- **Visibility**: Profile only visible if user has at least one public commit
- **Navigation**: Author names on public commits link to their profile

### Embed Widgets

Published commits can be embedded on external sites:

- **Embed URL**: `/embed/[slug]?view=card&theme=dark`
- **View types**:
  - `card` (200px) — Title, stats, author
  - `summary` (120px) — Compact preview
  - `full` (configurable) — Scrollable conversation
- **Themes**: `dark`, `light`, `auto`
- **Options**: `height` (for full view), `showAuthor` (true/false)
- **oEmbed**: `/api/oembed?url=...` for Notion, Medium, etc.
- **Script embed**: Include `embed.js` with `data-*` attributes

### Share Analytics

Published commits track view analytics:

- **Privacy-conscious**: Hashes IP+User-Agent for uniqueness, no PII stored
- **Rate limiting**: One view per visitor per day (unique constraint)
- **Metrics tracked**:
  - Total views / unique visitors
  - Views today / this week
  - Top referrer domains
  - Device breakdown (desktop/mobile/tablet)
- **Access control**: Only commit owner can view analytics (RLS enforced)
- **UI**: Eye icon with view count in dashboard, popover shows full breakdown

### Storage Paths

- **Local database**: `~/.tuhnr/global/data.db` — all projects in one SQLite DB
- **Project database**: `.tuhnr/data.db` — per-project SQLite DB
- **Auth tokens**: `~/.tuhnr/auth.json` — OAuth tokens (GitHub or anonymous)
- **Machine ID**: `~/.tuhnr/machine-id` — unique device identifier

### Environment Variables

- `TUHNR_SUPABASE_URL` — Supabase project URL (defaults to production)
- `TUHNR_SUPABASE_ANON_KEY` — Supabase anonymous key (defaults to production)

### Anonymous Auth (Feb 2026)

Users can sync without GitHub OAuth via anonymous auth:

```bash
tuhnr start    # Creates anonymous account, starts syncing immediately
tuhnr claim    # Links to GitHub later (preserves user_id, no data migration)
```

Key functions in `apps/cli/src/sync/auth.ts`:
- `signInAnonymously()` — Creates anonymous Supabase account
- `ensureAuthenticated()` — Returns existing user or creates anonymous
- `claimAccount()` — OAuth flow to link GitHub identity

The `UserProfile` type has `isAnonymous?: boolean` field. Anonymous users get `githubUsername: "anon-{id}"` and empty `githubId`.

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/cli/src/index.ts` | CLI entry point (imports command modules) |
| `apps/cli/src/commands/start.ts` | Unified start command (init + auth + daemon) |
| `apps/cli/src/commands/claim.ts` | Link anonymous account to GitHub |
| `apps/cli/src/commands/` | CLI command modules (parse, sync, studio, etc.) |
| `apps/cli/src/parser/extractor.ts` | Core parsing state machine |
| `apps/cli/src/storage/db.ts` | Database wrapper using repository pattern |
| `apps/cli/src/storage/repositories/` | Data access layer (commits, sessions, turns) |
| `apps/cli/src/storage/schema.ts` | Database schema + migrations |
| `apps/cli/src/sync/auth.ts` | GitHub OAuth PKCE flow |
| `apps/cli/src/sync/push.ts` | Push local commits to cloud |
| `apps/cli/src/commands/cloud.ts` | Cloud management commands (clear) |
| `apps/cli/src/sync/pull.ts` | Pull commits from cloud |
| `apps/cli/src/commands/stats.ts` | Statistics command |
| `apps/cli/src/commands/export.ts` | Export to JSON/Markdown |
| `apps/cli/src/commands/search.ts` | Full-text search |
| `apps/cli/src/commands/prune.ts` | Delete old commits |
| `apps/cli/src/studio/server.ts` | Local dashboard Hono server |
| `apps/web/app/(dashboard)/` | Web platform dashboard pages |
| `apps/web/app/(dashboard)/dashboard/DashboardClient.tsx` | Main dashboard component |
| `packages/types/src/index.ts` | Shared type definitions |
| `packages/supabase/src/client.ts` | Supabase client factory |
| `packages/supabase/src/transforms.ts` | DB ↔ frontend type transforms |
| `packages/supabase/src/queries.ts` | Supabase query functions |
| `packages/ui/src/ConversationViewer.tsx` | Full conversation viewer component |
| `packages/ui/src/CommitList.tsx` | Commit list sidebar component |
| `packages/ui/src/Header.tsx` | Dashboard header component |
| `apps/web/app/c/[slug]/page.tsx` | Public commit viewer page |
| `apps/web/app/c/[slug]/opengraph-image.tsx` | Dynamic OG image for social sharing |
| `apps/web/app/c/[slug]/twitter-image.tsx` | Dynamic Twitter image (2:1 ratio) |
| `apps/web/app/u/[username]/page.tsx` | Public user profile page |
| `apps/web/app/u/[username]/opengraph-image.tsx` | Dynamic OG image for profiles |
| `apps/web/app/u/[username]/twitter-image.tsx` | Dynamic Twitter image for profiles |
| `apps/web/app/embed/[slug]/page.tsx` | Embeddable commit view |
| `apps/web/app/embed/[slug]/EmbedCardView.tsx` | Card embed component (200px) |
| `apps/web/app/embed/[slug]/EmbedSummaryView.tsx` | Summary embed component (120px) |
| `apps/web/app/embed/[slug]/EmbedFullView.tsx` | Full embed component (scrollable) |
| `apps/web/app/api/oembed/route.ts` | oEmbed endpoint for external platforms |
| `apps/web/app/api/commits/[id]/publish/route.ts` | Publish commit API endpoint |
| `apps/web/app/api/commits/[id]/unpublish/route.ts` | Unpublish commit API endpoint |
| `apps/web/app/api/public/commits/[slug]/route.ts` | Public commit fetch API (no auth) |
| `apps/web/app/api/public/users/[username]/route.ts` | Public profile fetch API (no auth) |
| `apps/web/public/embed.js` | Script-based embed loader |
| `packages/ui/src/EmbedCodeModal.tsx` | Embed code generator modal |
| `apps/web/app/api/views/route.ts` | Record view API (POST, hashes IP+UA) |
| `apps/web/app/api/commits/[id]/analytics/route.ts` | Get analytics API (authenticated) |
| `apps/web/app/c/[slug]/ViewTracker.tsx` | Client component to record views |
| `packages/ui/src/AnalyticsPopover.tsx` | Analytics display popover |

---

## Development

### Rebuilding the CLI

After making changes to CLI source files (`apps/cli/src/**`), rebuild for the global `tuhnr` command:

```bash
pnpm --filter tuhnr build
```

This compiles TypeScript and bundles the studio dashboard. Without rebuilding, the global `tuhnr` command will use stale code.

### Supabase Migrations

Migrations live in `supabase/migrations/`. Apply them with:

```bash
supabase db push
```

This runs all pending migrations against the remote Supabase database. Requires `supabase` CLI and linked project.

---

## Design System

### Colors

| Token | Usage |
|-------|-------|
| `--chronicle-blue` | Primary action, links, current selection |
| `--chronicle-green` | Git hashes, success states, committed work |
| `--chronicle-amber` | File changed indicators, uncommitted work |
| `--chronicle-purple` | Parallel session indicators |

### LocalStorage Keys

| Key | Usage |
|-----|-------|
| `cogcommit-font-size` | User's preferred font size |
| `cogcommit-sidebar-width` | Sidebar width in pixels |
| `cogcommit-sidebar-collapsed` | Sidebar collapsed state |

---

## Critical: Dashboard Maintainability

**See `docs/dashboard-architecture.md` for full details.**

CogCommit has two dashboards (CLI Studio and Web) that must stay in sync. Key rules:

1. **Shared UI**: All visual components live in `@cogcommit/ui`. Edit there, not in app-specific code.
2. **Shared transforms**: Use `transformCommitWithRelations` from `@cogcommit/supabase` for data transformation.
3. **Test both**: After changes, verify both `pnpm dev --filter=web` and `cogcommit studio --global`.

### GOTCHA: Supabase Table Names

The Supabase tables are named `sessions` and `turns`, NOT `cognitive_sessions` and `cognitive_turns`:

```typescript
// CORRECT
.select(`*, sessions (*, turns (*))`)

// WRONG - returns empty sessions/turns
.select(`*, sessions:cognitive_sessions (*, turns:cognitive_turns (*))`)
```

This has caused multiple bugs. Always check `apps/cli/src/sync/push.ts` for canonical table names.

### GOTCHA: JSONB `->>` Returns TEXT in RPC Functions

When extracting values from JSONB with `->>` inside `SECURITY DEFINER` functions, PostgreSQL returns TEXT — not the column type. Always cast explicitly:

```sql
(t->>'id')::UUID
(t->>'timestamp')::TIMESTAMPTZ
(t->>'tool_calls')::JSONB
```

The Supabase REST API handles these casts transparently, so this only surfaces in raw SQL / RPC functions.

---

## Critical: Flexbox Scroll Bug

**This is the most common issue when working on UI.**

Flexbox layouts with `overflow-y-auto` children won't create independent scroll contexts if the root can expand. The whole page scrolls instead of individual panels.

### The Fix

```tsx
// Root - fixed to viewport, no page scroll
<div className="h-screen bg-bg flex flex-col overflow-hidden">
  <Header />
  <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
    {/* Panels with independent scroll */}
  </div>
</div>
```

**Key rules:**
- Root: `h-screen overflow-hidden` (NOT `min-h-screen`)
- Flex containers: `style={{ minHeight: 0 }}` to allow children to shrink
- Scroll containers: `style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}`
