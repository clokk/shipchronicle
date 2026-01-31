# Agentlogs Style Guide

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
+-----------------------------------+-----------------------------------+
|  COMMIT LIST (w-96)               |  COMMIT DETAIL (flex-1)           |
|  Scrollable list                  |  Scrollable conversation          |
+-----------------------------------+-----------------------------------+
```

- Left pane: `bg-panel`, fixed width `w-96`
- Right pane: `bg-panel-alt`, flex to fill
- App root: Radial vignette from `--bg` to black

### Scroll Containers

```tsx
// Root - fixed to viewport, no page scroll
<div className="h-screen app-root flex flex-col overflow-hidden">
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

## Component Patterns

### Cognitive Commit Card

```tsx
<div className={`border-l-2 ${hasGitHash ? 'border-commit-closed' : 'border-commit-open'} pl-4 py-3`}>
  <div className="flex items-center gap-2 text-sm">
    <span className="font-mono text-commit-closed">[abc123]</span>
    <span className="text-muted">12 turns</span>
  </div>
</div>
```

### Turn (User)

```tsx
<div className="bg-user-accent/5 border-l-2 border-user-accent pl-4 py-2 my-2">
  <span className="text-sm font-medium text-user-accent">User</span>
  <p className="text-primary">{content}</p>
</div>
```

### Turn (Assistant)

```tsx
<div className="bg-zinc-900/50 border-l-2 border-zinc-700 pl-4 py-2 my-2">
  <span className="text-sm font-medium text-muted">Assistant</span>
  <p className="text-primary">{content}</p>
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

## Animations

Only 2 signature animations are permitted:

| Animation | Duration | Usage |
|-----------|----------|-------|
| `slide-in-panel` | 0.2s | Detail panel entrance when selecting commit |
| `expand-accordion` | 0.2s | Tool call expansion |

```css
/* Applied via classes */
.animate-slide-in { /* Detail panels */ }
.animate-expand { /* Accordion sections */ }
```

**No micro-animations, hover wobbles, or loading spinners.**

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

| File | Purpose |
|------|---------|
| `src/studio/frontend/styles/tailwind.css` | CSS variables, animations, utility classes |
| `src/studio/frontend/index.html` | Font loading (Source Serif 4, Commit Mono) |
| `tailwind.config.js` | Tailwind theme extensions |
| `src/studio/frontend/App.tsx` | Main layout with app-root |
| `src/studio/frontend/components/CommitDetail.tsx` | Detail view with slide-in animation |
| `src/studio/frontend/components/TurnView.tsx` | Turn display with accordion animation |
