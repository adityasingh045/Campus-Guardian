UI/UX Design Document
Interaction Design & Visual Specification | Version 1.0

1. Design Principles
Principle	Application
Situational Awareness First	The live video feed dominates the screen; stats and alerts support, never obscure.
Glanceable Status	Color-coded badges (green/yellow/red) communicate risk level in < 1 second.
Progressive Disclosure	Default view shows summary; click an alert to see details and snapshot.
Dark-Mode Native	Security operators work in dim rooms; dark UI reduces eye strain and screen glare.
Zero-Training Operation	A new operator can understand the dashboard in < 30 seconds without documentation.
2. Information Architecture
text

Campus Guardian Dashboard (Single Page)
├── Navbar
│   ├── Logo + Title
│   ├── Subtitle (system description)
│   └── System Status Badge (Active / Error)
├── Main Content (3-column grid)
│   ├── Left Column (60%)
│   │   ├── Live Video Panel
│   │   │   ├── Video Header (camera name, LIVE badge)
│   │   │   ├── Annotated Video Stream
│   │   │   └── Calibration Button (overlay trigger)
│   │   └── Engine Status Bar
│   │       ├── Homography Status
│   │       ├── Inference Stats (FPS, latency)
│   │       └── Telegram Status
│   ├── Right Column Top (40%)
│   │   └── Stats Sidebar
│   │       ├── Risk Level Card
│   │       ├── People Count Card
│   │       ├── Closest Distance Card
│   │       └── Signal Breakdown Matrix
│   └── Right Column Bottom (40%)
│       └── Alerts Feed
│           ├── Feed Header (count)
│           └── Scrollable Alert Cards
└── (Modal Overlay — Phase 4)
    └── Calibration Wizard
        ├── Instruction text
        ├── Clickable video frame
        └── Confirm / Reset buttons
3. Wireframes
3.1 Main Dashboard (1920 × 1080)
text

┌────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ CAMPUS GUARDIAN    AI Proximity & Violence Detection    [● ACTIVE]    │
├─────────────────────────────────────────────┬──────────────────────────────┤
│                                             │  REAL-TIME RISK METRICS      │
│  LIVE CAMERA FEED — CAM_01        [● LIVE]  │                              │
│ ┌─────────────────────────────────────────┐ │  ┌────────┐ ┌──────┐ ┌─────┐│
│ │                                         │ │  │ OVERALL│ │PEOPLE│ │CLOSE││
│ │                                         │ │  │  RISK  │ │COUNT │ │ DIST││
│ │         [Annotated Video Stream]        │ │  │        │ │      │ │     ││
│ │                                         │ │  │ 🔴 HIGH│ │  3   │ │0.82m││
│ │    ┌─────┐          ┌─────┐            │ │  └────────┘ └──────┘ └─────┘│
│ │    │ ID:1│──────────│ ID:2│  0.82m ⚠️  │ │                              │
│ │    └─────┘          └─────┘            │ │  ACTIVE SIGNALS (2-of-3)     │
│ │                                         │ │  ┌──────────┐ ┌──────────┐  │
│ │                                         │ │  │⚠ Swing   │ │⚠ Raised  │  │
│ │                                         │ │  │ DETECTED │ │ DETECTED │  │
│ │                                         │ │  └──────────┘ └──────────┘  │
│ │                        [📐 Calibrate]   │ │  ┌──────────┐               │
│ └─────────────────────────────────────────┘ │  │✓ Fall    │               │
│                                             │  │ NORMAL   │               │
│ ┌─────────────────────────────────────────┐ │  └──────────┘               │
│ │ ✓ Homography Active                     │ │                              │
│ │ YOLOv8-pose + ByteTrack │ 28 FPS │ 32ms │ ├──────────────────────────────┤
│ │ Telegram: ✓ @CampusAlertsBot            │ │  INCIDENT & ALERT FEED (42)  │
│ └─────────────────────────────────────────┘ │                              │
│                                             │  ┌──────────────────────────┐│
│                                             │  │🔴 AGGRESSIVE PROXIMITY  ││
│                                             │  │  [📷] 0.82m │ Just now  ││
│                                             │  │  Swing + Raised Arm     ││
│                                             │  ├──────────────────────────┤│
│                                             │  │🟡 PROXIMITY WARNING     ││
│                                             │  │  [📷] 1.12m │ 4m ago    ││
│                                             │  ├──────────────────────────┤│
│                                             │  │🟡 FALL DETECTED         ││
│                                             │  │  [📷] Person 05 │ 12m   ││
│                                             │  ├──────────────────────────┤│
│                                             │  │         ...              ││
│                                             │  └──────────────────────────┘│
└─────────────────────────────────────────────┴──────────────────────────────┘
3.2 Calibration Overlay (Phase 4)
text

┌────────────────────────────────────────────────────────────────────────────┐
│  CALIBRATION MODE — Click 4 floor corners (2/4 placed)        [✕ Cancel] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                                                                  │    │
│    │       ① ●─────────────────────────────────● ②                   │    │
│    │       │                                   │                     │    │
│    │       │         [Live Video Frame]         │                     │    │
│    │       │                                   │                     │    │
│    │       │                                   │                     │    │
│    │       ③ ●                                 ○ ④ (click here)     │    │
│    │                                                                  │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│    Instructions: Click the 4 corners of a known rectangular area on the   │
│    floor (e.g., a 2m × 2m tile grid). Enter real-world dimensions below.  │
│                                                                            │
│    Width: [ 2.0 ] m    Height: [ 2.0 ] m    [✓ Confirm Calibration]      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
3.3 Mobile / Narrow View (1024px)
text

┌──────────────────────────────────────┐
│ 🛡️ CAMPUS GUARDIAN    [● ACTIVE]    │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │     [Live Video Stream]          │ │
│ │                                  │ │
│ │    ID:1 ──── ID:2   0.82m ⚠️    │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ RISK: 🔴 HIGH  │  PPL: 3  │ 0.82m  │
├──────────────────────────────────────┤
│ ALERTS                               │
│ ┌──────────────────────────────────┐ │
│ │ 🔴 Aggressive │ 0.82m │ Just now│ │
│ │ 🟡 Proximity  │ 1.12m │ 4m ago  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
4. User Flows
4.1 Primary Flow: Monitoring
text

START
  │
  ▼
[Operator opens dashboard URL]
  │
  ▼
[Frontend connects WebSocket] ──fail──▶ [Show "Reconnecting..." overlay]
  │                                              │
  success                                        │ (auto-retry)
  │                                              │
  ▼                                              │
[Live video appears] ◀───────────────────────────┘
  │
  ▼
[Stats sidebar populates: people count, distances, status]
  │
  ▼
[Operator monitors passively]
  │
  ├──▶ [Status changes to WARNING]  → Yellow badge, distance turns amber
  │
  ├──▶ [Status changes to DANGER]   → Red badge, alert fires
  │         │
  │         ▼
  │    [New alert card appears at top of feed]
  │    [Telegram notification sent (if configured)]
  │         │
  │         ▼
  │    [Operator clicks alert card] → sees snapshot + details
  │
  └──▶ [Status returns to SAFE]     → Green badge
4.2 Calibration Flow (Phase 4)
text

[Operator clicks "📐 Calibrate Floor"]
  │
  ▼
[Calibration overlay appears over video]
  │
  ▼
[Operator clicks point 1 (top-left corner of known floor area)]
  │
  ▼
[Operator clicks point 2 (top-right)]
  │
  ▼
[Operator clicks point 3 (bottom-left)]
  │
  ▼
[Operator clicks point 4 (bottom-right)]
  │
  ▼
[Operator enters real-world width and height in meters]
  │
  ▼
[Operator clicks "Confirm Calibration"]
  │
  ▼
[Frontend sends POST /api/calibrate]
  │
  ▼
[Backend computes homography, persists to DB]
  │
  ▼
[Overlay closes; distances switch from px → m]
  │
  ▼
["Calibrated ✓" indicator appears in status bar]
4.3 Alert Review Flow
text

[Operator scrolls alerts feed]
  │
  ▼
[Clicks an alert card]
  │
  ▼
[Expanded view shows: full snapshot, timestamp, reason breakdown, people count]
  │
  ▼
[Operator can cross-reference with live feed]
5. Design System
5.1 Color Tokens
Token Name	Hex	Tailwind Class	Usage
bg-canvas	#020617	bg-slate-950	Page background
bg-panel	#0f172a	bg-slate-900	Card/panel surfaces
bg-inset	#1e293b	bg-slate-800	Metric tiles, inner blocks
border-default	#334155	border-slate-700	Panel borders
border-subtle	#1e293b	border-slate-800	Dividers
text-primary	#f8fafc	text-slate-50	Headings
text-secondary	#94a3b8	text-slate-400	Labels, metadata
text-muted	#64748b	text-slate-500	Disabled, placeholder
accent-blue	#38bdf8	text-sky-400	Brand, tracking IDs, links
status-safe	#10b981	text-emerald-500	SAFE badge, calibrated
status-safe-bg	#064e3b	bg-emerald-900	SAFE badge background
status-warning	#f59e0b	text-amber-500	WARNING badge, approaching
status-warning-bg	#78350f	bg-amber-900	WARNING badge background
status-danger	#ef4444	text-red-500	DANGER badge, alerts
status-danger-bg	#7f1d1d	bg-red-900	DANGER badge background
status-danger-glow	#dc2626	border-red-600	Alert card border glow
5.2 Typography
Element	Font	Size	Weight	Tailwind
Page Title	System sans	24px	700	text-2xl font-bold
Section Header	System sans	16px	600	text-base font-semibold
Metric Value	System sans	28–32px	700	text-3xl font-bold
Metric Label	System sans	12px	400	text-xs text-slate-400
Body Text	System sans	14px	400	text-sm
Alert Title	System sans	14px	700	text-sm font-bold
Timestamp	System sans	11px	400	text-xs text-slate-500
Code/Mono	System mono	12px	400	font-mono text-xs
5.3 Spacing & Layout
Element	Value
Page padding	32px (p-8)
Panel gap	24px (gap-6)
Card padding	24px (p-6)
Card border radius	12px (rounded-xl)
Inner tile radius	8px (rounded-lg)
Grid columns	60% / 40% (grid-cols-[3fr_2fr])
5.4 Component Specifications
StatusBadge
text

Props: status ∈ {"SAFE", "WARNING", "DANGER"}

SAFE:    bg-emerald-900 border-emerald-500 text-emerald-300  "✓ SAFE"
WARNING: bg-amber-900   border-amber-500   text-amber-300    "⚠ WARNING"
DANGER:  bg-red-900     border-red-500     text-red-300      "🔴 DANGER"

Animation: DANGER state pulses (CSS animate-pulse)
AlertCard
text

Props: alert { id, timestamp, reason, people_count, snapshot_url }

Layout:  [110×75 thumbnail] | [title + reason + timestamp]
Border:  border-red-600 if < 5 min old, else border-slate-700
Hover:   bg-slate-800 transition
Click:   expand to show full snapshot modal (Phase 3+)
VideoPanel
text

Source:  WebSocket → base64 decode → <img src="data:image/jpeg;base64,...">
Aspect:  16:9 container, object-fit: contain
Overlay: Calibration button (bottom-right, semi-transparent)
Error:   "Waiting for video stream..." placeholder with spinner
6. Interaction Patterns
Pattern	Behavior
Live indicator	Red dot pulses at 1 Hz next to "LIVE" badge
Alert entrance	New alert slides in from top with 300ms ease-out
Status transition	Badge color cross-fades over 500ms
Distance color	Green > 2m, Yellow 1–2m, Red < 1m (continuous gradient)
Reconnecting	Semi-transparent overlay with spinner + "Reconnecting…" text
Empty state	Alerts feed shows "No alerts yet. System monitoring."
Calibration points	Numbered circles (①②③④) with connecting lines forming quadrilateral
7. Accessibility
Requirement	Implementation
Color contrast	All text meets WCAG AA (4.5:1) against dark backgrounds
Status not color-only	Badges include text label + icon (not just color)
Keyboard navigation	Alert cards focusable with Tab; Enter to expand
Screen reader	aria-live="polite" on alerts feed for new alert announcements
Reduced motion	Respect prefers-reduced-motion; disable pulse animations
