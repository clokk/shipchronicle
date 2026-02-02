# CogCommit Product Direction

Last updated: 2026-02-02

---

## Current Focus

"GitHub for AI conversations" - cloud repository with analytics.

| Feature | Status |
|---------|--------|
| Import Claude Code sessions | ✓ |
| Smart project detection | ✓ |
| Local dashboard | ✓ |
| Cloud sync (push/pull) | ✓ |
| Web dashboard | ✓ |
| Search in dashboard | ✓ |
| Usage limits | ✓ |
| Analytics v1 | In progress |
| Public sharing | In progress |
| Per-commit quick stats | In progress |

### Deferred Features

These are valuable but deferred for now:
- Product state previews (screenshots, live rebuilds)
- Vercel/Netlify preview URL integration
- Multi-platform support (Cursor, Copilot, etc.)
- Team/org view (B2B - high potential, post-launch)

Claude Code is the beachhead. Expand after core is solid.

---

## Analytics

The goal: give users a reason to open CogCommit, not just set-and-forget backup.

### Core Insight

User sentiment is embedded in the conversation itself. We don't need external quality metrics - we can infer success/failure from how the conversation flows.

### The Model

```
Task start → Turns → Resolution
                      ↓
              Happy (moves on) or Unhappy (iterates/rejects)
```

### Signals (detectable from conversation)

| Signal type | Examples |
|-------------|----------|
| **Task boundary** | New topic, "now let's...", "next...", shift in files |
| **Success** | Moves to new task, "perfect", "thanks", "looks good", commit shortly after |
| **Rejection** | "No", "that's wrong", "undo", "revert", "not what I meant" |
| **Stuck** | Repeated similar prompts, long turn sequences on same topic |

### MVP Analytics (v1)

Focus on commit-level metrics first. Simple, already have the data.

| Metric | Implementation | Value |
|--------|----------------|-------|
| **Prompts per cognitive commit** | Count prompts in each commit | Shows iteration patterns |
| **Simple sentiment detection** | Keyword matching for approval/rejection | Flags struggles |
| **Dashboard summary** | "This week: 12 commits, avg 4.2 prompts, 2 rejections" | The "reason to open" |
| **Per-commit indicators** | Visual badge: smooth vs struggled | At-a-glance understanding |

**Skip for v1:**
- Task detection within commits (complex)
- Tool call pattern breakdowns
- Historical trends/graphs

### Future Analytics (v2+)

| Metric | Why it matters |
|--------|----------------|
| **First-prompt success rate** | % of tasks resolved in 1-2 prompts |
| **Rejection/correction frequency** | Learn what prompts lead to mistakes |
| **Task-level iteration count** | More granular than commit-level |
| **Tool call patterns** | Heavy reads = exploring, heavy edits = implementing |
| **"Stuck" detection** | Flag when spinning wheels |
| **Session shape visualization** | Visual rhythm of a session |

### Task Detection (future)

Cognitive commits can contain multiple tasks. Hybrid approach: auto-detect with manual correction.

**Auto-detection heuristics:**
- New user message after commit or explicit approval
- Significant topic shift (different files, new feature area)
- Explicit markers: "now", "next", "moving on", "let's do"
- Long gap between turns

**Manual correction UX:**
- Tasks appear as segments within a cognitive commit
- User can merge tasks ("these were one thing")
- User can split tasks ("this was two separate things")
- User can mark resolution type (success / rejection / abandoned)

### Long-term Vision

Learn prompting patterns from aggregate data:
- What prompt styles lead to fewer iterations?
- What types of tasks cause the most struggle?
- How does collaboration improve over time?
- Benchmarking across users (opt-in)

---

## Free Tier & Limits

### Design Principles

1. **Local is unlimited** - user's data on their machine, always works
2. **Cloud is the premium** - sync, backup, sharing, analytics
3. **First-run shouldn't punish** - users with lots of history shouldn't hit wall immediately
4. **Limits should feel fair** - based on real cost, not artificial scarcity

### The Problem

Users may have 500+ commits locally before they even sign up. If free tier is 250 commits and they hit the limit on first import, they bounce frustrated.

### Solution: Local Unlimited, Cloud Caps Recent

Local dashboard works with full history. Cloud syncs most recent N commits.

**Free tier:**
- 250 commits synced to cloud
- 50 MB storage
- Unlimited local history
- Full analytics on synced commits

**The UX:**

```
$ cogcommit push
Found 800 commits locally
Syncing most recent 250 to cloud (free tier)
→ Want full history? Upgrade at cogcommit.com/pro
```

**Dashboard display:**
```
142 / 250 commits synced • 12 MB / 50 MB
```

### Implementation Notes

- Track `synced_at` timestamp on commits to know what's in cloud
- Query commits ordered by `closed_at DESC`, limit to free tier count
- Store user's tier and limits in Supabase `users` table
- Check limits before push, return clear error if exceeded

### Future: Paid Tier

Not implementing yet, but the upgrade path:
- Unlimited cloud sync
- Full history
- Team features (shared repos)
- Priority support

For now: implement limits with "paid tier coming soon" message.

---

## Public Sharing

The viral loop: make it easy to share "here's how I built this" with a link.

### Privacy Model

| State | Behavior |
|-------|----------|
| **Private (default)** | Only you can see. Synced to cloud but not accessible to others. |
| **Public** | Anyone with link can view. Optionally shows on public profile. |

### UX Principles

1. **Private by default** - Nothing public until explicit action
2. **Per-commit control** - Publish individual commits, not all-or-nothing
3. **Deliberate action** - "Publish" button, not a toggle. Confirmation step.
4. **Clear visual indicator** - Badge on each commit: 🔒 Private / 🌐 Public
5. **Easy to unpublish** - Mistakes reversible instantly

### The Viral Loop

```
Dashboard → Select commit → "Publish" → Copy link → Share
```

The easier this flow, the more likely people share. Optimize for minimal friction.

### URL Structure

```
cogcommit.com/c/{public_slug}   → Public viewer (no auth)
cogcommit.com/@{username}       → Public profile (all public commits)
cogcommit.com/dashboard         → Private dashboard (auth required)
```

### Database Changes

```sql
-- Add to cognitive_commits table
is_public: boolean DEFAULT false
public_slug: text UNIQUE  -- generated on publish, e.g. "a1b2c3d4"
published_at: timestamp

-- Optional: control profile visibility
-- Add to users table
profile_public: boolean DEFAULT true  -- show public commits on profile
```

### Publish Flow

1. User clicks "Publish" on a commit
2. Confirmation modal: "This will make the conversation publicly viewable. Continue?"
3. Generate `public_slug` if not exists
4. Set `is_public = true`, `published_at = now()`
5. Show success with copy-able link
6. Badge updates to 🌐 Public

### Unpublish Flow

1. User clicks "Unpublish" on a public commit
2. Set `is_public = false`
3. Link immediately stops working (slug preserved for re-publish)
4. Badge updates to 🔒 Private

### Public Viewer Page

`cogcommit.com/c/{slug}` shows:
- Commit title / first prompt
- Turn count, duration, files touched
- Full conversation (read-only)
- Author attribution with link to profile
- "Powered by CogCommit" footer + CTA

**No auth required** - anyone can view.

### Public Profile Page

`cogcommit.com/@{username}` shows:
- User info (name, avatar from GitHub)
- List of all public commits
- Total stats: "42 public commits, 1.2k prompts shared"

### Future Enhancements

- **Embed code** - `<iframe>` snippet for blogs/READMEs
- **Highlight reel** - Mark key turns, only show those in shared view
- **Unlisted option** - Accessible via link but not on profile
- **Expiring links** - Auto-unpublish after N days
- **Custom slugs** - `cogcommit.com/c/my-cool-feature`

---

## Per-Commit Quick Stats

Every commit card should show at-a-glance metrics.

### Display

```
┌────────────────────────────────────────────────┐
│ 🔒 Add authentication flow         12 prompts │
│ 45 min • 8 files • smooth                     │
└────────────────────────────────────────────────┘
```

### Metrics

| Metric | Source |
|--------|--------|
| **Prompt count** | Count of prompts in commit |
| **Duration** | `closed_at - started_at` |
| **Files touched** | Count of unique files in tool calls |
| **Sentiment** | "smooth" / "struggled" from keyword detection |

### Implementation

Most of this data already exists - just surface it in the UI. Calculate on import or query on render.

---

## Future: Team/Org View (B2B)

High potential post-launch feature for enterprise customers.

### Value Prop

- See how your team collaborates with AI
- Identify who's struggling, who's thriving
- Share effective prompting patterns across org
- Onboarding: "here's how our senior devs use AI"

### Features

- Org dashboard with aggregate stats
- Team member list with individual metrics
- Shared prompt library (extracted from commits)
- Admin controls for privacy/visibility

### Business Model

This is where paid tiers make sense:
- Free: Individual use
- Team: $X/seat/month - shared workspace, team analytics
- Enterprise: Custom pricing - SSO, audit logs, support

### Notes

Defer until individual product is validated. But keep architecture flexible for multi-tenancy.
