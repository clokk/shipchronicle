# Agentlogs Style Guide

## Design Philosophy

**"Chronicle Interface"** - A dark, focused aesthetic that feels like navigating through time. The interface should feel like a time machine for code: professional, readable, and designed for exploration.

- **The Void is Dark**: Rich blacks, not pure black - easy on the eyes for long reading
- **Time Flows Left-to-Right**: Timeline is the primary navigation metaphor
- **Conversation is Primary**: Code supports the narrative, not the other way around
- **State Changes are Visible**: Clear visual indicators when the product evolves

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | #0c0a09 | Main background |
| `--panel` | #18181b | Cards, panels, left sidebar |
| `--panel-alt` | #1c1917 | Right pane (product view), alternate panels |
| `--chronicle-blue` | #38bdf8 | Primary action, links, current commit indicator |
| `--chronicle-green` | #4ade80 | Git commit hashes, success states |
| `--chronicle-amber` | #fbbf24 | File changed indicators, warnings |
| `--chronicle-purple` | #a78bfa | Parallel session indicators |
| `--text` | #e4e4e7 | Primary text |
| `--muted` | #a1a1aa | Secondary text, timestamps |
| `--subtle` | #71717a | Tertiary text, metadata |

### Semantic Colors

| Token | Usage |
|-------|-------|
| `--user` | #38bdf8 | User message background tint |
| `--assistant` | #18181b | Assistant message background |
| `--commit-closed` | #4ade80 | Committed cognitive commit |
| `--commit-open` | #fbbf24 | Uncommitted work |
| `--file-read` | #a1a1aa | File was read |
| `--file-changed` | #fbbf24 | File was modified |

## Typography

| Font | Usage |
|------|-------|
| **Inter** | UI text, conversation content, navigation |
| **JetBrains Mono** | Git hashes, file paths, code snippets, timestamps |

Text hierarchy:
- `text-foreground` - Primary content, conversation text
- `text-muted` - Timestamps, metadata, secondary info
- `text-subtle` - Placeholders, disabled states

## Layout

### Split Pane (Desktop)

```
┌─────────────────────────────────┬─────────────────────────────────┐
│  COGNITIVE COMMITS (50%)        │  PRODUCT STATE (50%)            │
│  Scrollable conversation        │  Screenshot/preview/iframe      │
└─────────────────────────────────┴─────────────────────────────────┘
├───────────────────────────────────────────────────────────────────┤
│  TIMELINE SCRUBBER                                                │
└───────────────────────────────────────────────────────────────────┘
```

- Left pane: `bg-panel`, conversation flow
- Right pane: `bg-panel-alt`, product visuals
- Divider: `border-white/10`, draggable
- Timeline: Fixed bottom, `bg-bg`

### Mobile

Stacked layout with sticky thumbnail or tab switching (TBD).

## Component Patterns

### Cognitive Commit Card

```tsx
<div className="border-l-2 border-chronicle-green pl-4 py-3">
  <div className="flex items-center gap-2 text-sm">
    <span className="font-mono text-chronicle-green">[abc123]</span>
    <span className="text-muted">· 12 turns</span>
    <span className="text-subtle">· 2:30 PM</span>
  </div>
  <div className="mt-2 text-foreground">
    {/* Expandable turns */}
  </div>
</div>
```

Uncommitted work uses `border-chronicle-amber`.

### Turn (User)

```tsx
<div className="bg-chronicle-blue/5 border-l-2 border-chronicle-blue pl-4 py-2 my-2">
  <p className="text-foreground">{content}</p>
  <span className="text-xs text-muted font-mono">{timestamp}</span>
</div>
```

### Turn (Assistant)

```tsx
<div className="bg-panel pl-4 py-2 my-2">
  <p className="text-foreground">{content}</p>
  {toolCalls && <ToolCallIndicator calls={toolCalls} />}
  <span className="text-xs text-muted font-mono">{timestamp}</span>
</div>
```

### Tool Call Indicator

```tsx
<div className="flex items-center gap-1 text-xs text-muted mt-1">
  <span className="text-chronicle-amber">●</span>
  <span className="font-mono">Edit: src/auth.ts</span>
</div>
```

### Timeline Scrubber

```tsx
<div className="h-12 bg-bg border-t border-white/10 flex items-center px-4">
  <div className="flex-1 relative h-1 bg-white/10 rounded">
    {commits.map((commit, i) => (
      <div
        key={commit.id}
        className="absolute w-2 h-2 rounded-full bg-chronicle-green -top-0.5"
        style={{ left: `${(i / total) * 100}%` }}
      />
    ))}
    <div className="absolute w-3 h-3 rounded-full bg-chronicle-blue -top-1 cursor-pointer"
         style={{ left: `${currentPosition}%` }} />
  </div>
  <span className="ml-4 text-sm text-muted font-mono">
    Commit {current} of {total}
  </span>
</div>
```

### File Change Badge

```tsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-chronicle-amber/10 text-chronicle-amber rounded">
  <span>●</span> src/auth.ts
</span>
```

### Parallel Session Indicator

```tsx
<div className="flex items-center gap-2 text-sm text-chronicle-purple">
  <span>⚡</span>
  <span>Parallel work detected</span>
</div>
```

### Git Hash

```tsx
<span className="font-mono text-chronicle-green">[{hash.slice(0, 7)}]</span>
```

### Collapsible Section

```tsx
<details className="group">
  <summary className="cursor-pointer flex items-center gap-2 text-muted hover:text-foreground">
    <span className="group-open:rotate-90 transition-transform">▶</span>
    <span>{title}</span>
    <span className="text-subtle">({count} items)</span>
  </summary>
  <div className="mt-2 pl-4 border-l border-white/5">
    {children}
  </div>
</details>
```

## Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| `fade-in` | 0.3s | Content appearing |
| `slide-in` | 0.2s | Panel transitions |
| `expand` | 0.2s | Collapsible sections |
| `pulse` | 1s | Loading states |
| `scrub` | instant | Timeline navigation (no delay) |

Timeline navigation should feel instant - no animation delay when scrubbing.

## Spacing

- Panel padding: `p-4` to `p-6`
- Turn spacing: `my-2`
- Section gaps: `space-y-4`
- Timeline height: `h-12`

## Key Principles

1. **Conversation is readable** - Long-form text should be comfortable to read
2. **Navigation is instant** - Timeline scrubbing, commit jumping should feel immediate
3. **State changes are obvious** - Clear visual distinction when product state updates
4. **Code is secondary** - Diffs available on demand, not dominating the view
5. **Parallel work is visible** - Multiple sessions clearly indicated, not confusing

## Known Issues & Fixes

### Independent Scroll Containers (Fixed Jan 2026)

**Problem:** Flexbox layouts with `overflow-y-auto` children weren't creating independent scroll contexts. The whole page would scroll instead of individual panels.

**Root Cause:** Using `min-h-screen` on the root allowed content to expand beyond the viewport, causing page-level scroll instead of panel-level scroll.

**Solution:**
- Root container: Use `h-screen overflow-hidden` (fixed height, no page scroll)
- Flex containers: Add `style={{ minHeight: 0 }}` to allow flex children to shrink
- Scroll containers: Use `style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}`

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

## Key Files (Future)

| File | Purpose |
|------|---------|
| `src/app/globals.css` | CSS variables, animations, base styles |
| `src/app/layout.tsx` | Font loading (Inter, JetBrains Mono) |
| `src/components/Timeline.tsx` | Timeline scrubber component |
| `src/components/CognitiveCommit.tsx` | Commit card with turns |
| `src/components/SplitPane.tsx` | Resizable split layout |
| `tailwind.config.ts` | Tailwind theme extensions |
