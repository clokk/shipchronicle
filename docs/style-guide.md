# CogCommit Style Guide

## Design Philosophy

**"Anti-Slop Interface"** - A distinctive, archival aesthetic that rejects generic design patterns. The interface should feel like a time machine for code: professional, readable, and intentionally different from typical developer tools.

- **The Void is Warm**: Rich warm blacks, not cold or pure black
- **Typography is Distinctive**: Serif body text as an intentional choice
- **Motion is Restrained**: Maximum 2 animation types, no micro-interactions
- **Colors are Semantic**: Muted, purposeful accents over default blues

## Color Palette

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | #0d0b0a | Main background with radial vignette |
| `--panel` | #181614 | Cards, panels, left sidebar |
| `--panel-alt` | #1e1b18 | Right pane, alternate panels |

### Primary Accent

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | #e07b39 | Primary action buttons, links |
| `--accent-hover` | #c66a2d | Hover state for accent |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--commit-closed` | #5fb88e | Git commit hashes, success states (muted sage) |
| `--commit-open` | #d4a030 | Uncommitted work, file changes (warm amber) |
| `--user-accent` | #3d84a8 | User message indicators (muted teal) |
| `--parallel` | #9d7cd8 | Parallel session indicators (muted lavender) |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | #e8e4df | Primary text, conversation content |
| `--muted` | #a39e97 | Secondary text, timestamps, metadata |
| `--subtle` | #6d6862 | Tertiary text, placeholders |

## Typography

| Font | Usage |
|------|-------|
| **Source Serif 4** | UI text, conversation content, navigation - distinctive serif choice |
| **Commit Mono** | Git hashes, file paths, code snippets, timestamps |

### Hierarchy

- Primary content uses `--text` color
- Timestamps and metadata use `--muted`
- Placeholders and disabled states use `--subtle`

## Layout

### Split Pane (Desktop)

```
┌──────────────┬─┬─────────────────────────────┐
│ Commits  [◀] │▌│  Conversation               │
│              │▌│                             │
│  (resizable) │▌│  (flex-1)                   │
└──────────────┴─┴─────────────────────────────┘
```

- Left pane: `bg-panel`, resizable (200-600px), collapsible to 48px
- Resizer: 4px draggable divider, highlights on hover/drag
- Right pane: `bg-panel-alt`, flex to fill
- App root: Radial vignette from `--bg` to black

### Sidebar States

**Expanded**: Shows full commit list with collapse button (◀)
**Collapsed**: 48px strip with mini commit indicators and expand button (▶)

### Scroll Containers

```tsx
// Root - fixed to viewport, no page scroll
<div className="h-screen app-root flex flex-col overflow-hidden">
  <Header />
  <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
    {/* Left panel - resizable, collapsible */}
    <div style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}>...</div>
    {/* Resizer */}
    <div className="w-1 cursor-col-resize" onMouseDown={handleMouseDown} />
    {/* Right panel */}
    <div className="flex-1 overflow-hidden">
      <DetailView />
    </div>
  </div>
</div>
```

**Key rules:**
- Root: `h-screen overflow-hidden` (NOT `min-h-screen`)
- Flex containers: `style={{ minHeight: 0 }}` to allow children to shrink
- Scroll containers: `style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}`

### User Preferences (localStorage)

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `cogcommit-sidebar-width` | number | 384 | Sidebar width in pixels |
| `cogcommit-sidebar-collapsed` | boolean | false | Sidebar collapsed state |
| `cogcommit-font-size` | number | 16 | Conversation font size (12-20px) |

## Component Patterns

### Cognitive Commit Card

```tsx
<div className={`border-l-2 ${hasGitHash ? 'border-commit-closed' : 'border-commit-open'} pl-4 py-3`}>
  <div className="flex items-center gap-2 text-sm">
    <span className="font-mono text-commit-closed">[abc123]</span>
    <span className="text-muted">12 prompts</span>
  </div>
</div>
```

### Turn (User)

```tsx
<div className="bg-user-accent/5 border-l-2 border-user-accent pl-4 py-2 my-2">
  <span className="text-sm font-medium text-blue-400">User</span>
  <p className="text-zinc-200">{content}</p>
</div>
```

### Turn (Assistant)

```tsx
<div className="bg-zinc-900/50 border-l-2 border-zinc-700 pl-4 py-2 my-2">
  <span className="text-sm font-medium text-muted">Assistant</span>
  <p className="text-zinc-200">{content}</p>
</div>
```

### Git Hash

```tsx
<span className="font-mono text-commit-closed">[{hash.slice(0, 7)}]</span>
```

### Uncommitted Indicator

```tsx
<span className="font-mono text-commit-open">[uncommitted]</span>
```

### Font Size Controls

Located in the turn navigation bar at bottom of conversation view:

```tsx
<div className="flex items-center gap-1 border border-zinc-700 rounded">
  <button onClick={decreaseFontSize}>
    <span className="text-xs font-bold">A</span>
  </button>
  <span className="text-xs font-mono">{fontSize}</span>
  <button onClick={increaseFontSize}>
    <span className="text-sm font-bold">A</span>
  </button>
</div>
```

Available sizes: 12, 14, 16, 18, 20px (default: 16px)

### Compact Header

The conversation header is condensed to 2 rows:

```
Row 1: [project] [abc123] · 232 prompts · 15 files  [/ search] [Delete]
Row 2: Click to add title...
```

- Stats inline with metadata using dot separators
- Search input expands on focus (w-36 → w-48)
- Reduced padding (p-4 instead of p-6)

### Tool-Only Groups

Consecutive assistant turns with only tool calls (no text) are grouped into a single compact row:

```tsx
<div className="rounded-lg p-3 border-l-2 bg-zinc-900/30 border-zinc-700">
  <div className="text-xs text-zinc-500">6 tool calls</div>
  <div className="flex flex-wrap gap-1">
    {toolCalls.map(tc => (
      <button className="px-2 py-0.5 text-xs font-mono bg-zinc-800">{tc.name}</button>
    ))}
  </div>
</div>
```

- Groups consecutive tool-only turns to save vertical space
- Each tool pill is clickable to expand details
- Shows count of tools in the group

### Item Navigation

Navigation uses "items" (visual groups) instead of raw turns:

```
◀  [ 3 / 15 ]  ▶   User
```

- Fixed-width counter (`w-32 text-center`) keeps arrows stationary
- Tool groups count as 1 item
- `j/k` navigates items, `J/K` skips to user messages
- Item type shown separately (User/Agent/N tools)

## Animations

We use a restrained animation palette with Framer Motion for skeleton loading states:

### Permitted Animations

| Animation | Library | Duration | Usage |
|-----------|---------|----------|-------|
| `slide-in-panel` | CSS | 0.2s | Detail panel entrance when selecting commit |
| `expand-accordion` | CSS | 0.2s | Tool call expansion |
| `shimmer` | Framer Motion | 1.5s | Skeleton loading gradient sweep |
| `stagger-children` | Framer Motion | 0.08s delay | Sequential card appearance |
| `animate-pulse` | Tailwind | 2s | Fallback skeleton pulse |

### Framer Motion Skeleton Animations

**Shimmer Effect** - A subtle gradient sweep across skeleton elements:

```tsx
import { motion } from "framer-motion";

export function Shimmer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-y-0 w-full"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      />
    </div>
  );
}
```

**Stagger Animation** - Cards fade in sequentially:

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Usage
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={cardVariants}>
      {/* Card content */}
    </motion.div>
  ))}
</motion.div>
```

### Skeleton Placeholders

Use `bg-subtle/40` with `animate-pulse` for skeleton elements:

```tsx
<div className="h-5 w-24 bg-subtle/40 rounded animate-pulse" />
<div className="h-5 w-3/4 bg-subtle/40 rounded animate-pulse" />
```

### Animation Guidelines

- **DO**: Use shimmer + stagger for skeleton loading states
- **DO**: Keep shimmer opacity subtle (7% white on dark backgrounds)
- **DO**: Use `animate-pulse` as a fallback/complement to shimmer
- **DON'T**: Add hover animations or micro-interactions
- **DON'T**: Use loading spinners (prefer skeleton loaders)
- **DON'T**: Animate content that's already loaded

```css
/* Applied via classes */
.animate-slide-in { /* Detail panels */ }
.animate-expand { /* Accordion sections */ }
```

## Anti-Slop Design Principles

### Typography

- **DO**: Use serif body text (Source Serif 4) as a distinctive choice
- **DON'T**: Default to Inter, Roboto, or system sans-serif
- **WHY**: Serif typography signals intentionality and creates archival feel

### Colors

- **DO**: Use warm accents (burnt orange) and muted semantics (sage, teal)
- **DON'T**: Use default blues (#38bdf8), bright neons, or cold grays
- **WHY**: Warm palette is easier on eyes and feels more intentional

### Motion

- **DO**: Maximum 2 animation types, both functional
- **DON'T**: Add hover animations, loading spinners, or micro-interactions
- **WHY**: Motion should serve function, not decoration

### Visual Effects

- **DO**: Subtle radial vignette on app background
- **DON'T**: Drop shadows, gradient buttons, glassmorphism
- **WHY**: Depth should be implied, not forced

### General

- **DO**: Leave intentional whitespace, let typography breathe
- **DON'T**: Fill every pixel, add decorative elements
- **WHY**: Restraint is the defining characteristic

## Key Files

### CLI Studio (Local Viewer)

| File | Purpose |
|------|---------|
| `src/studio/frontend/styles/tailwind.css` | CSS variables, animations, utility classes |
| `src/studio/frontend/index.html` | Font loading (Source Serif 4, Commit Mono) |
| `tailwind.config.js` | Tailwind theme extensions |
| `src/studio/frontend/App.tsx` | Main layout with app-root |
| `src/studio/frontend/components/CommitDetail.tsx` | Detail view with slide-in animation |
| `src/studio/frontend/components/TurnView.tsx` | Turn display with accordion animation |

### Web Dashboard

| File | Purpose |
|------|---------|
| `packages/ui/src/Shimmer.tsx` | Reusable shimmer animation component |
| `packages/ui/src/CommitCardSkeleton.tsx` | Single card skeleton with shimmer + motion |
| `packages/ui/src/CommitListSkeleton.tsx` | List skeleton with stagger animation |
| `apps/web/app/(dashboard)/dashboard/loading.tsx` | Route transition loading state |
| `apps/web/app/(dashboard)/dashboard/DashboardClient.tsx` | Client component with loading state |
