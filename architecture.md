DOCUMENT 2: Architecture Document
System Architecture & Technical Design | Version 1.0

1. Architecture Overview
Campus Guardian follows a monolithic backend + SPA frontend architecture, chosen for simplicity of deployment (single docker compose up) and low operational overhead appropriate for a competition demo and small-campus deployment.

1.1 High-Level Block Diagram
text

┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              React SPA (Vite + Tailwind)                      │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐   │  │
│  │  │ Video    │  │ Stats        │  │ Alerts Feed            │   │  │
│  │  │ Panel    │  │ Sidebar      │  │ (REST + WS push)       │   │  │
│  │  │ (WS img) │  │ (WS JSON)   │  │                        │   │  │
│  │  └────┬─────┘  └──────┬───────┘  └──────────┬─────────────┘   │  │
│  │       │               │                      │                 │  │
│  │       └───────────────┼──────────────────────┘                 │  │
│  │                       │                                        │  │
│  │            WebSocket + REST (HTTP)                              │  │
│  └───────────────────────┼────────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVER TIER (FastAPI)                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway Layer                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │   │
│  │  │ REST     │  │ WebSocket    │  │ CORS / Middleware      │  │   │
│  │  │ Router   │  │ Manager      │  │                        │  │   │
│  │  └────┬─────┘  └──────┬───────┘  └────────────────────────┘  │   │
│  └───────┼───────────────┼──────────────────────────────────────┘   │
│          │               │                                          │
│  ┌───────▼───────────────▼──────────────────────────────────────┐   │
│  │                   Service Layer                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│  │  │ Alert        │  │ Calibration  │  │ Notification       │  │   │
│  │  │ Service      │  │ Service      │  │ Service (Telegram) │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │   │
│  └─────────┼─────────────────┼────────────────────┼─────────────┘   │
│            │                 │                    │                 │
│  ┌─────────▼─────────────────▼────────────────────▼─────────────┐   │
│  │              Detection Engine (Background Task)               │   │
│  │                                                               │   │
│  │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌───────────┐  │   │
│  │  │ Camera  │──▶│ YOLOv8   │──▶│ ByteTrack │──▶│ Signal    │  │   │
│  │  │ Reader  │   │ -pose    │   │ (Ultra-   │   │ Computer  │  │   │
│  │  │ (cv2)   │   │ Infer-   │   │  lytics)  │   │ (Prox,    │  │   │
│  │  │         │   │  ence    │   │           │   │  Swing,   │  │   │
│  │  │         │   │          │   │           │   │  Arm,     │  │   │
│  │  │         │   │          │   │           │   │  Fall)    │  │   │
│  │  └─────────┘   └──────────┘   └───────────┘   └─────┬─────┘  │   │
│  │                                                      │        │   │
│  │  ┌──────────────┐   ┌────────────────────────────────▼──────┐ │   │
│  │  │ Homography   │   │ Temporal Confirmation + Alert Logic   │ │   │
│  │  │ Transformer  │   │ (2-of-3 rule, N-frame confirm,        │ │   │
│  │  │ (cv2)        │   │  cooldown)                            │ │   │
│  │  └──────────────┘   └───────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Data Layer                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│  │  │ SQLite       │  │ File Store   │  │ In-Memory State    │  │   │
│  │  │ (SQLAlchemy  │  │ (snapshots/) │  │ (track buffers,    │  │   │
│  │  │  2.0 async)  │  │              │  │  signal history)   │  │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼ (optional, outbound)
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│  ┌──────────────────┐                                               │
│  │ Telegram Bot API │  (HTTPS POST, fire-and-forget)                │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
2. Component Details
2.1 Detection Engine (backend/app/detection/)
This is the computational core. It runs as an asyncio background task started on FastAPI's lifespan event.

text

detection/
├── __init__.py
├── engine.py          # Main loop: capture → infer → track → signals → broadcast
├── camera.py          # CameraReader class (cv2.VideoCapture wrapper with retry)
├── pose_estimator.py  # YOLOv8-pose wrapper (model load + inference)
├── tracker.py         # ByteTrack wrapper (thin layer over Ultralytics track)
├── signals.py         # Signal computer (proximity, swing, arm, fall)
├── temporal.py        # Temporal buffer + confirmation logic + cooldown
├── homography.py      # Homography compute + transform
├── annotator.py       # Frame annotation (boxes, skeletons, labels, lines)
└── config.py          # DetectionConfig dataclass (all thresholds)
Data flow within the engine (per frame):

text

cv2.VideoCapture.read()
        │
        ▼
  numpy ndarray (BGR, H×W×3)
        │
        ▼
  pose_estimator.predict(frame)
        │
        ▼
  List[Detection]  (bbox, keypoints[17×3], confidence)
        │
        ▼
  tracker.update(detections)
        │
        ▼
  List[TrackedPerson]  (track_id, bbox, keypoints, history)
        │
        ▼
  homography.transform_foot_points(persons)  [if calibrated]
        │
        ▼
  signals.compute_all(persons, history_buffer)
        │
        ▼
  SignalResult  (per-pair distances, per-person flags)
        │
        ▼
  temporal.confirm(signal_result, frame_count)
        │
        ▼
  Alert? ──Yes──▶ alert_service.fire()
        │                    │
        No                   ▼
        │            DB insert + snapshot save
        │            + WebSocket broadcast
        │            + Telegram send (async)
        ▼
  annotator.draw(frame, persons, signals, alerts)
        │
        ▼
  base64 JPEG → WebSocket broadcast (throttled)
2.2 API Layer (backend/app/api/)
text

api/
├── __init__.py
├── routes_health.py    # GET /, GET /api/health
├── routes_alerts.py    # GET /api/alerts, GET /api/alerts/{id}, GET /api/alerts/{id}/snapshot
├── routes_calibrate.py # POST /api/calibrate, GET /api/calibrate/{camera_id}
└── ws_live.py          # WebSocket /ws/live
2.3 Service Layer (backend/app/services/)
text

services/
├── __init__.py
├── alert_service.py      # Create alert, save snapshot, broadcast, notify
├── calibration_service.py # Compute + persist homography
└── telegram_service.py    # Send photo + caption (no-op if unconfigured)
2.4 Data Layer (backend/app/db/)
text

db/
├── __init__.py
├── models.py       # SQLAlchemy ORM: Alert, Calibration
├── session.py      # Async engine + session factory
└── init_db.py      # Table creation on startup
2.5 Frontend (frontend/src/)
text

src/
├── App.jsx                 # Root layout (3-column grid)
├── main.jsx                # React entry
├── index.css               # Tailwind directives
├── hooks/
│   ├── useWebSocket.js     # WS connection + auto-reconnect
│   └── useAlerts.js        # REST fetch + WS push merge
├── components/
│   ├── VideoPanel.jsx      # Live MJPEG display
│   ├── StatsSidebar.jsx    # Metrics cards + signal breakdown
│   ├── AlertsFeed.jsx      # Scrollable alert list
│   ├── AlertCard.jsx       # Single alert item
│   ├── StatusBadge.jsx     # SAFE / WARNING / DANGER pill
│   ├── CalibrationOverlay.jsx  # 4-point click UI (Phase 4)
│   └── Navbar.jsx          # Top bar
└── utils/
    └── api.js              # Fetch helpers
3. Data Flow Diagrams
3.1 Alert Lifecycle
text

  Detection Engine          Alert Service          Data Layer         External
  ────────────────          ─────────────          ──────────         ────────
       │                         │                     │                  │
  [Signal confirmed]             │                     │                  │
       │                         │                     │                  │
       │── fire_alert(data) ────▶│                     │                  │
       │                         │                     │                  │
       │                         │── save snapshot ───▶│ (filesystem)     │
       │                         │                     │                  │
       │                         │── INSERT alert ────▶│ (SQLite)         │
       │                         │                     │                  │
       │                         │── broadcast ───────▶│ (WebSocket)      │
       │                         │    {type:"alert"}   │                  │
       │                         │                     │                  │
       │                         │── send_photo ──────────────────────────▶│ Telegram
       │                         │    (async, non-blocking)               │
       │                         │                     │                  │
       │◀── alert_id ────────────│                     │                  │
       │                         │                     │                  │
3.2 WebSocket Frame Pipeline
text

  Engine Loop (30 FPS)          Throttle (15 FPS)         WebSocket Manager
  ──────────────────            ────────────────          ─────────────────
       │                              │                         │
  [annotated frame]                   │                         │
       │                              │                         │
       │── cv2.imencode(.jpg) ───────▶│                         │
       │                              │                         │
       │── base64.b64encode ─────────▶│                         │
       │                              │                         │
       │── build JSON payload ───────▶│                         │
       │    {frame, stats, ts}        │                         │
       │                              │── if 1/15s elapsed ────▶│
       │                              │                         │── send to
       │                              │                         │   all clients
4. Technology Decisions & Rationale
Decision	Alternatives Considered	Rationale
FastAPI over Flask/Django	Flask (simpler), Django (batteries)	Native async + WebSocket support; auto-generated OpenAPI docs; Pydantic validation
SQLite over PostgreSQL	PostgreSQL (scalable), Redis (fast)	Zero-config; single-file; sufficient for single-camera alert volume (~100s/day); ships with Python
SQLAlchemy 2.0 async over raw sqlite3	raw sqlite3 (lighter), Tortoise ORM	Type-safe ORM; migration support if needed later; async compatible
WebSocket over SSE	SSE (simpler), long-polling	Bidirectional (needed for calibration clicks); lower overhead than polling; native FastAPI support
Base64 JPEG in WS over WebRTC	WebRTC (lower latency), HLS	WebRTC requires STUN/TURN server (complex for demo); base64 JPEG is "good enough" at 15 FPS for a demo
React + Vite over Next.js/Vue	Next.js (SSR), Vue (lighter)	Vite is fastest dev experience; no SSR needed (SPA); Tailwind integration is mature
Tailwind over CSS modules/MUI	MUI (component library), CSS modules	Rapid prototyping; utility-first fits dashboard layout; small bundle
Vite preview over Nginx	Nginx (production-grade)	Simpler Dockerfile (no nginx config); sufficient for demo; can swap later
Ultralytics track() over custom DeepSORT	DeepSORT (proven), SORT (simpler)	Built into Ultralytics; no extra dependency; ByteTrack is state-of-the-art
yolov8n-pose over yolov8s/m/l	Larger models (more accurate)	Nano runs at 15+ FPS on CPU; sufficient accuracy for demo; can swap via config
5. Deployment Architecture
text

┌─────────────────────────────────────────────────┐
│              Docker Host                         │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Container: cg-backend (python:3.11-slim)   │ │
│  │  Port: 8000                                  │ │
│  │  Volumes:                                    │ │
│  │    ./backend/data → /app/data (SQLite)       │ │
│  │    ./backend/snapshots → /app/snapshots      │ │
│  │  Devices (optional): /dev/video0             │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Container: cg-frontend (node:20-alpine)    │ │
│  │  Port: 5173                                  │ │
│  │  Serves: Vite build output                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Network: bridge (default)                       │
│  Backend ↔ Frontend: via host port mapping       │
└─────────────────────────────────────────────────┘
6. Security Architecture
Concern	Mitigation
Secrets in code	All via .env / env vars; .env in .gitignore
CORS	Configurable; * for dev, specific origin for prod
Input validation	Pydantic models on all API inputs
File path traversal	Snapshot paths constructed from DB id, not user input
SQL injection	SQLAlchemy parameterized queries (no raw SQL)
DoS via WebSocket	Connection limit (configurable, default 20)
Telegram token leak	Token never logged; only used in outbound HTTPS
