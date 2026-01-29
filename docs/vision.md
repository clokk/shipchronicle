# Shipchronicle

> The chronicle of shipping. Explore how products evolve through human-AI collaboration.

**Domain:** shipchronicle.com (available)

## Status: Idea → Ready to Build

## The Vision

Navigate through commits. See the product at each state. Read the conversation that shaped it. *Understand* how this thing was built.

Not code diffs. Not git logs. The actual product evolution, explorable at your own pace, with the human-AI collaboration as narrative context.

```
┌─────────────────────────────┬─────────────────────────┐
│                             │                         │
│   Product State             │   Conversation          │
│   (live rebuild or          │                         │
│    screenshot)              │   Human: "The button    │
│                             │   should be more        │
│   ┌─────────────────────┐   │   prominent"            │
│   │                     │   │                         │
│   │   [interactive      │   │   Claude: "I'll make    │
│   │    product at       │   │   it larger and add     │
│   │    commit N]        │   │   color contrast..."    │
│   │                     │   │                         │
│   └─────────────────────┘   │   Human: "Perfect,      │
│                             │   ship it"              │
│                             │                         │
├─────────────────────────────┴─────────────────────────┤
│   ◀◀   ◀   ▶   ▶▶      commit 12 of 47              │
│   ━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
└───────────────────────────────────────────────────────┘
```

## The Problem

AI collaboration is invisible. One-shot culture shows polished results without the iteration. This is:
- **Dishonest** — misrepresents how work actually happens
- **Bad for learning** — can't see effective collaboration patterns
- **Bad for evaluation** — can't assess process, only outputs

The process IS the portfolio now. But it's hidden.

## The Reframe

| Old thinking | New thinking |
|--------------|--------------|
| Code history visualization | Product evolution chronicle |
| For developers reviewing diffs | For anyone exploring how something was built |
| Technical tool | Storytelling tool |
| Shows code changes | Shows transformation you can explore |
| Linear playback | Non-linear navigation (jump, collapse, compare) |

## Core Concept: The Cognitive Commit

The **Cognitive Commit** is the new unit of work. It replaces the vague "conversation-to-commit" mapping with a concrete model.

```
┌──────────────────────────────────────────────────────────────┐
│  Cognitive Commit                                            │
├──────────────────────────────────────────────────────────────┤
│  Prompt    │ The instruction(s) that drove the work         │
│  Context   │ Files referenced/read (paths only, not content)│
│  Diff      │ The resulting code changes                      │
└──────────────────────────────────────────────────────────────┘
```

**The parallel to git:**

| Git | Cognitive Commit |
|-----|------------------|
| Many file changes → one commit | Many turns → one cognitive commit |
| Commit message = summary | First prompt = intent |
| `git diff` shows what changed | Turns show how it evolved |
| `git log` shows history | Timeline of cognitive commits |

**What closes a Cognitive Commit:**
1. **Git commit** — The natural boundary. Links directly to a hash.
2. **Session end** — Work done but not committed. Exploratory, research, or abandoned.
3. **Explicit close** — User manually marks a boundary.

**Rejected work stays in.** The iteration is the valuable part. Even failed attempts show thinking process.

---

## Visual Concept: Git-Based Rebuild

**Long-term vision:** Actually rebuild and run the product at each commit.

- Checkout commit → build → run → interact
- Scrub the timeline, feel the product evolve
- If the build is broken at that commit? *That's honest representation.* Show the error. That was the state.

**Why this matters:**
- Screenshots are static. This is interactive.
- You don't just see the product—you *use* it at each stage
- The feeling of progress becomes tangible
- Non-developers can experience the build journey

**Constraints:**
- Only works for web (initially)
- Requires project to be buildable at each commit
- Needs sandboxed build environment

## Fallback: Screenshots

When git-based rebuild isn't possible:
- Non-web projects
- Build broken at commit
- Performance/cost constraints

Capture methods:
- Manual screenshots on commit
- Automated capture (Playwright/Puppeteer) if dev server running
- Screen recording synced to commits

Show screenshot with indicator: "Build state unknown" or "Build failed at this commit" — still honest.

## Technical Architecture (Validated)

### Claude Code Log Structure

**Location:** `~/.claude/projects/<project-path>/<session-uuid>.jsonl`

**What's available:**

| Data | Status | Notes |
|------|--------|-------|
| User prompts | ✅ | Full text, timestamped |
| Assistant responses | ✅ | Including thinking blocks |
| File edits | ✅ | Tool calls with old/new diffs |
| File reads | ✅ | Tool results with content |
| Bash commands | ✅ | Including git commands |
| Git commit hashes | ✅ | In tool_result output |
| Timestamps | ✅ | ISO format on every message |
| Session threading | ✅ | uuid/parentUuid chains |

**Retention:** Files persist at least 3 weeks. Largest sessions ~25MB.

### Data Model

```
CognitiveCommit
├── id: uuid
├── project_id: fk → Project
├── closed_by: "git_commit" | "session_end" | "explicit"
├── git_hash: nullable
├── started_at: timestamp
├── closed_at: timestamp
├── sessions: Session[]           ← supports parallel Claudes
├── parallel: boolean             ← true if sessions overlapped
├── files_read: string[] (paths only)
├── files_changed: string[] (paths with diffs)
├── visuals: Visual[]             ← screenshots/videos attached
└── published: boolean            ← included in public chronicle

Session
├── id: uuid (maps to Claude session UUID)
├── cognitive_commit_id: fk
├── label: string (optional, user-provided: "auth work")
├── started_at: timestamp
├── ended_at: timestamp
└── turns: Turn[]

Turn
├── id: uuid
├── session_id: fk → Session
├── role: "user" | "assistant"
├── content: text
├── timestamp: timestamp
├── accepted: boolean
├── triggers_visual_update: boolean  ← for UI indicators
└── tool_calls: ToolCall[]

Visual
├── id: uuid
├── cognitive_commit_id: fk
├── type: "screenshot" | "video" | "vercel_preview" | "netlify_preview" | "custom_url"
├── url: string (asset path or preview URL)
├── captured_at: timestamp
├── caption: string (optional)
├── auto_captured: boolean        ← true if captured by daemon
└── embed_compatible: boolean     ← true for preview URLs (interactive iframe)
```

### Architecture: CLI + Web

```
LOCAL (CLI)                          CLOUD (Web)
───────────                          ───────────
shipchronicle watch                  shipchronicle.com/studio
├── reads ~/.claude/projects/        ├── view captures
├── watches for new entries          ├── curate (delete, caption)
├── detects git commits              ├── reorder/hide commits
├── auto-captures screenshots        └── publish
│   (Puppeteer, when server up)
├── stores in local SQLite           shipchronicle.com/v/[id]
└── syncs to cloud                   └── public viewer
```

### Storage Strategy

**Local:** SQLite database in `~/.shipchronicle/` or project `.shipchronicle/` directory.

**Cloud:**
- Cognitive commits + metadata synced automatically
- Screenshots uploaded to cloud storage (S3/R2)
- Only published commits visible in public viewer

**What gets stored:**

| Data | Local | Cloud |
|------|-------|-------|
| User prompts | ✅ | ✅ (if published) |
| Assistant responses | ✅ | ✅ (if published) |
| Files changed (diffs) | ✅ | ✅ (if published) |
| Screenshots | ✅ | ✅ (uploaded) |
| Git hash | ✅ | ✅ |
| Files read (paths) | ✅ | ❌ |

### CLI Commands

```bash
# Initialize project
shipchronicle init

# Start watching (background daemon)
shipchronicle watch
shipchronicle watch --port 3000  # specify dev server port

# Stop watching
shipchronicle stop

# Manual capture
shipchronicle capture            # screenshot now
shipchronicle capture --video 5  # 5-second video

# Parse existing logs (one-time import)
shipchronicle parse

# View status
shipchronicle status

# Open web studio
shipchronicle studio             # opens browser to studio
```

### Deploy Platform Integration

Auto-detect Vercel, Netlify, Cloudflare Pages, and similar platforms to capture live preview URLs instead of screenshots.

**Detection:**
```bash
# Vercel: vercel.json or .vercel/
# Netlify: netlify.toml or .netlify/
# Cloudflare: wrangler.toml (Pages projects)
```

**How it works:**
1. On `shipchronicle init`, detect deploy platform
2. On git commit, query platform API for preview URL
3. Store preview URL as visual (type: `vercel_preview`, etc.)
4. In viewer, render as interactive iframe

**Visual source priority:**
| Scenario | Visual Source |
|----------|---------------|
| Vercel/Netlify detected | Live preview URL (interactive iframe) |
| Local dev server running | Auto-captured screenshot (Puppeteer) |
| No server detected | No visual (conversation-only) |
| Non-web project | Manual screenshot/video upload |

**Example flow:**
```
$ shipchronicle watch
Watching ~/myproject...
Vercel project detected ✓
Preview URLs will be captured automatically

[14:23] Commit abc123 pushed
        Vercel deploy: https://myproject-abc123-team.vercel.app ✓
        12 turns recorded

[15:47] Commit def456 pushed
        Vercel deploy: https://myproject-def456-team.vercel.app ✓
        8 turns recorded
```

**Viewer behavior:**
- Preview URL available → interactive iframe embed
- Screenshot available → static image
- Both available → toggle between them
- Neither → conversation-only view

### Privacy

- Project-scoped opt-in
- Selective publishing (choose which cognitive commits to share)
- Sanitization step for secrets (regex + high-entropy detection)

## User Flows

**Recording (developer):**
```
$ cd ~/myproject
$ shipchronicle init
Initialized shipchronicle for myproject.
Config: .shipchronicle/config.json

$ shipchronicle watch
Watching ~/myproject...
Dev server detected at localhost:3000
Auto-capture enabled ✓

... work with Claude Code, make commits ...

[14:23] Commit abc123: "Add auth flow"
        Auto-captured screenshot ✓
        12 turns recorded

[15:47] Commit def456: "Fix login bug"
        Auto-captured screenshot ✓
        8 turns recorded

$ shipchronicle studio
Opening shipchronicle.com/studio/myproject...
```

**Curation (web studio):**
```
┌─────────────────────────────────────────────────────────┐
│  Studio: myproject                        [Publish All] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ☑ Commit abc123: "Add auth flow" (12 turns)           │
│    [screenshot preview]  [Edit Caption] [Delete]        │
│                                                         │
│  ☐ Commit def456: "Fix login bug" (8 turns)            │
│    [screenshot preview]  [Edit Caption] [Delete]        │
│    ^ uncheck to exclude from public chronicle           │
│                                                         │
│  [Publish Selected →]                                   │
└─────────────────────────────────────────────────────────┘
```

**Viewing (anyone):**
```
┌──────────────────────────────────────────────────────────────────┐
│  Shipchronicle: RepoRealms                      [Compare] [⚙]   │
├────────────────────────────────┬─────────────────────────────────┤
│  COGNITIVE COMMITS             │  PRODUCT STATE  [Live ▼]       │
│                                │                                 │
│  ▼ Commit 12: "Add hex grid"  │  ┌─────────────────────────────┐│
│    │ User: "Create the..."    │  │                             ││
│    │ Claude: [response]       │  │  [interactive preview]      ││
│    │ 🔵 [code change]         │  │  or [screenshot]            ││
│    └──────────────────────    │  │                             ││
│                                │  └─────────────────────────────┘│
│  ▶ Commit 13 (8 turns)        │                                 │
│  ▶ Commit 14 (12 turns)       │  [Live ▼] = toggle dropdown:   │
│                                │    • Live Preview (Vercel)     │
│  ─── Parallel work ───        │    • Screenshot                 │
│  ┌ Claude A: 12 turns ┐       │                                 │
│  ┌ Claude B: 8 turns  ┐       │  ┌─────────────────────────────┐│
│                                │  │ Code Drawer (on demand)     ││
│                                │  │ +45 -12 lines               ││
│                                │  └─────────────────────────────┘│
├────────────────────────────────┴─────────────────────────────────┤
│  ◀ ▶  [━━━━━●━━━━━━━━━━━━━━━]  Commit 12 of 47                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key UX principles:**
- **Pure viewer.** Navigate at your own pace. Nothing auto-plays.
- **Collapsed by default.** Cognitive commits show as one line with turn count. Expand to see full conversation.
- **Bidirectional navigation.** Click commit → product updates. Click timeline → both update. Scroll conversation → product updates at marked turns.
- **Clear update indicators.** 🔵 markers show exactly which turns change the product view.
- **Code on demand.** Diff drawer appears when clicking code indicators. Conversation and product stay primary.
- **Timeline scrubber.** Bottom bar shows all commits. Click to jump anywhere.
- **Comparison mode.** Header button enters compare mode to view any two commits side-by-side.

## Parallel Claude Sessions

When multiple Claudes work on the same project simultaneously, the linear timeline breaks down.

**Threaded View (default):**
```
┌─────────────────────────────────────────────────────┐
│  Commit 15: "Implement auth + update UI"            │
│                                                      │
│  ┌─ Claude A (auth) ─────────────────────┐          │
│  │  "Add JWT validation..."               │          │
│  │  → 12 turns                            │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  ┌─ Claude B (ui) ───────────────────────┐          │
│  │  "Update login form..."                │          │
│  │  → 8 turns                             │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  ⚡ Parallel work (2:15pm - 2:47pm)                  │
└─────────────────────────────────────────────────────┘
```

**Swim Lanes (toggle for overview):**
```
Time →
┌─────────────────────────────────────────────────────┐
│ Claude A (auth):  ████░░░░████████░░░░░░████       │
│ Claude B (ui):    ░░░░████████░░░░████████░░       │
│ Claude C (tests): ░░░░░░░░░░░░░░░░░░████████████   │
└─────────────────────────────────────────────────────┘
                         ↓
                    [git commit]
```

**Data model addition:**
```
CognitiveCommit
├── ...existing fields...
├── sessions: Session[]    ← multiple sessions per commit
└── parallel: boolean      ← flag if sessions overlapped
```

---

## Comparison View

For "commit 5 vs commit 45" — show how far the product evolved.

**Entry point:** [Compare] button in header → enters comparison mode → select two commits from timeline.

```
┌─────────────────────────────────────────────────────────┐
│  Compare: Commit 5 → Commit 45                    [Exit]│
├──────────────────────────┬──────────────────────────────┤
│  Before (Commit 5)       │  After (Commit 45)           │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │  [product state]   │  │  │  [product state]       │  │
│  └────────────────────┘  │  └────────────────────────┘  │
├──────────────────────────┴──────────────────────────────┤
│  40 commits · 12 sessions · 2 weeks                     │
│  Key changes: +auth, +dashboard, ~api refactor          │
│  [━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━] │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Side-by-side product states
- Overlay toggle: fade between states to see subtle changes (Figma pattern)
- Summary of changes between selected commits
- Timeline with both selected points marked

Use cases: portfolio storytelling, code review, learning.

---

## UX Research Summary

Design decisions informed by research into GitHub, Loom, Figma, Notion, Slack, and AI collaboration tools.

### Patterns Adopted

| Pattern | Source | Why |
|---------|--------|-----|
| Split-space architecture | Claude Artifacts, ChatGPT Canvas | Conversation + product need dedicated space |
| Bidirectional navigation | Loom transcripts | Click either side to navigate; user chooses primary mode |
| Chapters as commits | Loom, Figma | Cognitive commits = named, jumpable sections |
| Collapsed by default | Notion toggles | Long content doesn't overwhelm; expand on demand |
| Single-level threading | Slack | Parallel sessions as flat threads, not nested |
| Side-by-side comparison | Figma | Clear before/after for any two commits |
| Overlay with transparency | Figma | Fade between states to spot subtle changes |
| Code drawer on demand | GitHub, Cursor | Diffs available but don't dominate the view |
| Timeline scrubber | Video players | Visual overview + jump navigation |

### Anti-Patterns Avoided

| Anti-Pattern | Source | Why It Fails |
|--------------|--------|--------------|
| Tab fragmentation | GitHub | Conversation/commits/files as tabs breaks flow |
| Linear-only navigation | Loom video | Can't skim, can't jump — forces creator's pace |
| Nested sub-threads | Early chat designs | Too complex, users lose track |
| Inline thread expansion | Early Slack | Replies in main view caused disorientation |
| Hidden threading | Various | Features buried in menus get low adoption |

---

## Mobile UX

Split-screen doesn't work on mobile. Two options under consideration:

**Option A: Stacked with sticky thumbnail**
```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │ [product thumbnail] │ │  ← sticky, tap to expand
│ └─────────────────────┘ │
├─────────────────────────┤
│  ▼ Commit 12            │
│    Turn 1: "Add..."     │
│    Turn 2: [response]   │
└─────────────────────────┘
```

**Option B: Tab/swipe between views**
```
┌─────────────────────────┐
│ [Conversation] [Product]│  ← tabs or swipe
├─────────────────────────┤
│                         │
│  Full-width view of     │
│  selected panel         │
│                         │
└─────────────────────────┘
```

**Decision: TBD** — needs prototyping to determine which feels better.

---

## Who Cares

| Audience | Value |
|----------|-------|
| **Learners** | "Show me how this went from nothing to this" |
| **Builders** | Portfolio pieces that show journey, not just result |
| **Building-in-public audiences** | Actually watchable content |
| **Non-technical people** | Understand product evolution without reading code |
| **Hiring managers** | See how someone thinks and collaborates |
| **Companies (assessment)** | Evaluate AI collaboration skills in candidates — see below |

## Hiring & Assessment Use Case

A potentially stronger business case than individual portfolios.

**The problem for companies:**
- Can't evaluate AI collaboration skills from resumes
- Traditional coding interviews penalize AI usage
- Take-home projects might be AI-assisted, but *how* is invisible

**What a Shipchronicle reveals about a candidate:**
- Do they know when to prompt vs. code directly?
- Do they catch AI mistakes or blindly accept?
- How do they iterate? How do they unstick when stuck?
- **Context management** — do they curate what the model sees, or dump everything? Do they know when to start fresh vs. continue? This is a trainable, valuable skill that's currently invisible.

**Why this changes the friction equation:**
If the company administers the assessment, they can *require* the tooling. Candidate installs it, does the take-home, submits the Shipchronicle. Friction becomes acceptable because it's mandated, not optional. Different adoption path than hoping for voluntary recording.

**Open question:** Even with mandated use, friction still matters for candidate experience. Worth investing in seamless capture early — with Claude Code integration, we can likely eliminate most manual steps.

## Name

**Shipchronicle** — the chronicle of shipping.

- "Ship" is the right dev culture language
- "Chronicle" implies structured historical record, exploration
- Domain available: shipchronicle.com
- Works as verb: "I'll shipchronicle this build"

Considered: Chronicle, Chronicler, Buildchron, Throughline, Strata, Cognicle, Shipchronicle, ShipLog, MakingOf

## Connection to Other Projects

- **RepoRealms** — code as territory (spatial view)
- **This** — product as timeline (temporal view)
- **contexTUI** — curates context for AI dev
- **This** — reveals the context that shaped the output

Complementary views of the same insight: make the invisible process visible.

## MVP Scope (Phased)

### Phase 1: The Parser
- **Goal:** Prove we can read Claude logs and extract Cognitive Commits
- **Deliverable:** CLI script (`shipchronicle parse`)
- **Input:** `~/.claude/projects/<project>/` session files
- **Output:** JSON array of `{ prompt, turns, git_hash, timestamp }`
- **Validation:** Run on a real project, verify data extraction

### Phase 2: CLI Daemon + Auto-Capture
- **Goal:** Background recording with automatic screenshot capture
- **Deliverable:** CLI tool (`shipchronicle watch`)
- **Features:**
  - Watch Claude logs for new entries
  - Detect git commits
  - Auto-capture screenshots via Puppeteer (when dev server detected)
  - Sync cognitive commits + visuals to cloud
  - Config file for project settings

```
$ shipchronicle watch
Watching ~/myproject...
[Commit abc123] Auto-captured screenshot ✓
[Commit def456] Auto-captured screenshot ✓
Synced to: shipchronicle.com/studio/myproject
```

### Phase 3: Web Studio (Curation)
- **Goal:** Review and curate captures before publishing
- **Deliverable:** `shipchronicle.com/studio`
- **Features:**
  - View all captured cognitive commits
  - Delete unwanted captures
  - Add/edit captions for visuals
  - Reorder or hide commits
  - Publish to public chronicle

### Phase 4: Web Viewer (Public)
- **Goal:** Shareable chronicles
- **Deliverable:** `shipchronicle.com/v/[id]`
- **Features:**
  - Renders cognitive commit timeline
  - Split view: conversation left, product right
  - Bidirectional navigation (click, scroll, timeline)
  - Clear visual indicators for product state changes
  - Code-on-demand drawer
  - Comparison view

**Agent Trace Integration:**

Consider supporting the [Agent Trace](https://agent-trace.dev/) open standard being developed by Cursor and industry partners (Anthropic, Google, Vercel, Cloudflare, etc.). Agent Trace is a vendor-neutral format for recording AI code attribution at the line level.

| Agent Trace | Shipchronicle |
|-------------|---------------|
| Line-level attribution | Full conversation chronicle |
| "Which code came from AI?" | "How did this get built?" |
| Metadata in codebase | Standalone viewer |
| Provenance & auditing | Portfolios & learning |

**Potential integration points:**
- **Export**: Generate `.agent-trace.json` from cognitive commits, linking turns to file changes
- **Import**: Enrich chronicles with line-level attribution data from Agent Trace files
- **Serve as context URL**: Agent Trace links to conversation URLs — Shipchronicle could be that destination
- **Bidirectional linking**: Chronicle shows "view attribution" → Agent Trace shows "view full conversation"

This positions Shipchronicle as the narrative layer complementing Agent Trace's attribution layer.

### Immediate Next Step

**Build the parser.** Locate a JSONL from a recent session, write a script to extract `{ Prompt, ToolCalls, Timestamp }`. Once proven, add the watch daemon.

## Future Features

**Viewer enhancements:**
- Annotation layer (add commentary to any turn after the fact)
- Search within chronicles (find specific work, patterns)
- Embeddable widget for portfolios/READMEs
- Assessment mode (code diffs prominent, for hiring use case)
- Keyboard navigation (j/k, vim-style)

**Capture improvements:**
- Video clip capture (short recordings of interactions)
- VS Code / Cursor extension (integrated recording experience)
- Team collaboration (multiple human contributors)
- Branching visualization (show dead ends, pivots)
- Interactive embed option (for deployed preview URLs)

---

## The Bigger Picture

The chronicle isn't just a viewer — it's a **format** for representing human-AI collaboration. Structured data enables what video cannot.

### Why Text + Structure Beats Video

| Capability | Video (Loom) | Chronicle |
|------------|--------------|-----------|
| Jump to specific feature work | Scrub and guess | Click commit |
| Read prompts at your own pace | Pause, squint | Native text |
| Collapse boring debugging | Can't | Collapse by session |
| Search for patterns | Impossible | Grep the data |
| Analyze prompt quality | Manual review | Automated detection |
| Flag accepted errors | Watch and catch | Static analysis on diffs |
| Identify collaboration patterns | Study manually | Aggregate across chronicles |

### What Structured Data Enables

**Prompt coaching:**
- Detect ambiguous or unclear prompts
- Suggest improvements: "This prompt led to 3 rounds of clarification — here's how to be more specific upfront"
- Learn from patterns: what prompt styles lead to faster convergence?

**Error detection:**
- Static analysis on accepted diffs: "You accepted code that introduced a null pointer risk"
- Flag commits where bugs were later fixed: "This pattern of accept-then-fix suggests missed review"
- Track which types of errors get caught vs. missed

**Pattern recognition:**
- How do you break down tasks? (Large vs. small cognitive commits)
- When do you intervene vs. let the AI run?
- What's your context management style?
- How does collaboration evolve over a project's lifetime?

**Benchmarking & training:**
- Compare collaboration patterns across developers
- Identify what "good" human-AI collaboration looks like
- Training data for future AI tools that assist with prompting

### The Format as Infrastructure

Git became the format for version control. Markdown became the format for documentation.

The chronicle format could become how we represent *the process of building software with AI* — not just the output, but the collaboration that produced it.

The viewer is the first application. The format is the foundation.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Claude log format changes | Own the data: ingest into SQLite immediately, don't rely on log persistence |
| Log rotation loses data | Live daemon ingestion (Phase 2+) |
| Server startup time for screenshots | Detect Vite/Next.js HMR, or warn user about render time |
| Secret leaks in conversations | Sanitization step: regex + high-entropy string detection |
| Commit-to-conversation alignment is fuzzy | Cognitive Commit model handles this — git commit is a "keyframe", turns accumulate between keyframes |

## Open Questions

- ~~Best way to hook into Claude Code conversation history?~~ **Answered:** Parse `~/.claude/projects/` JSONL files
- Sandboxed build environment: Docker? WebContainers? Cloud? (Phase 3+)
- Business model: free for public, paid for private?
- How to handle very long conversations? Summarization? Collapsible sections?
- Amend commits: append to existing Cognitive Commit or create new one?

## Meta

This idea emerged from a conversation about honest representation and working in public. The first use case: document building this tool with this tool.

## Links

- Related: `projects/contextui.md`, `ideas/reporealms.md`
- See also: `me/values.md` (honest representation as core value)
