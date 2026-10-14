# Campus Guardian — Product Requirements Document (PRD)

---

| Field | Detail |
|---|---|
| **Project Name** | Campus Guardian |
| **Document Version** | 1.0.0 |
| **Status** | Draft — Active Development |
| **Last Updated** | 2025-07-11 |
| **Author** | Campus Guardian Team |
| **Stakeholders** | College Tech Competition Judges, Campus Security Staff, University IT |
| **Confidentiality** | Internal / Competition Submission |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [Scope](#5-scope)
6. [System Architecture](#6-system-architecture)
7. [Functional Requirements](#7-functional-requirements)
8. [Data Model](#8-data-model)
9. [API Specification](#9-api-specification)
10. [WebSocket Protocol](#10-websocket-protocol)
11. [UI / UX Specification](#11-ui--ux-specification)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Deployment & Infrastructure](#13-deployment--infrastructure)
14. [Phased Delivery Plan](#14-phased-delivery-plan)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Appendices](#16-appendices)

---

## 1. Executive Summary

**Campus Guardian** is a real-time, AI-powered campus safety monitoring system that uses a single webcam feed to detect person-to-person proximity violations and suspicious or violent behavior (aggressive arm swings, raised arms, falls). It combines **YOLOv8-pose** skeletal estimation with **ByteTrack** multi-object tracking to compute behavioral risk signals, confirms them temporally over *N* consecutive frames to reduce false positives, and surfaces everything on a live web dashboard with an alert history, real-world distance readouts (via homography calibration), and optional Telegram push notifications.

The system is designed to be **demo-ready for a college tech competition**: it deploys with a single `docker compose up` command, runs end-to-end on commodity hardware, and includes a guided demo script for live judging.

---

## 2. Problem Statement

| # | Problem | Current State |
|---|---------|---------------|
| P1 | Campus security teams cannot monitor all open areas (courtyards, corridors, parking lots) in real time with human guards alone. | CCTV feeds are passively recorded and reviewed only *after* an incident. |
| P2 | When altercations or falls occur, response time is delayed because nobody is actively watching the feed. | Average incident-to-response time on campus: **8–15 minutes**. |
| P3 | Existing "smart camera" solutions are proprietary, expensive, and require specialized hardware. | Budget for campus safety tech at most universities: **< $5,000/year**. |
| P4 | Raw pixel-distance measurements from cameras are meaningless without real-world calibration. | Most open-source demos report distance in pixels, which changes with camera angle and zoom. |

---

## 3. Target Users & Personas

### Persona A — Campus Security Operator ("Priya")
- **Role:** Monitors the dashboard during her shift in the security office.
- **Needs:** See live video with overlays, get instant alerts when something happens, review past incidents with snapshots.
- **Tech comfort:** Moderate; uses a web browser daily but is not a developer.

### Persona B — University IT Admin ("David")
- **Role:** Deploys and maintains the system on a campus server.
- **Needs:** One-command deployment, clear config via environment variables, minimal dependencies, Docker-based.
- **Tech comfort:** High; comfortable with Linux, Docker, and networking.

### Persona C — Competition Judge ("Dr. Rao")
- **Role:** Evaluates the project during a 5-minute live demo.
- **Needs:** Immediate visual impact, clear explanation of the AI pipeline, evidence of real-world applicability.
- **Tech comfort:** High; expects technical depth but wants to see it *work*, not just hear about it.

---

## 4. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| **G1** Detect proximity violations in real time | Alert latency (event → dashboard) | **< 2 seconds** |
| **G2** Detect violent/suspicious behavior | True positive rate on staged demo scenarios | **≥ 90%** |
| **G3** Minimize false positives | False alert rate during 10 min of normal activity | **≤ 2 alerts** |
| **G4** Provide real-world distance | Distance accuracy after calibration | **± 0.3 m** within 5 m range |
| **G5** Zero-config deployment | Time from `git clone` to running dashboard | **< 5 minutes** |
| **G6** Competition demo readiness | Judge can see full pipeline in live demo | **5-minute guided flow** |

---

## 5. Scope

### 5.1 In Scope (v1.0)

- Single-camera live video ingestion (webcam index or RTSP URL).
- YOLOv8-pose skeletal keypoint detection + ByteTrack multi-object tracking.
- Four detection signals:
  1. **Proximity** — real-world distance between tracked person pairs.
  2. **Wrist-swing speed** — angular velocity of wrist keypoints over time.
  3. **Raised arm** — wrist keypoint above shoulder keypoint for sustained frames.
  4. **Fall posture** — bounding-box aspect ratio shift (vertical → horizontal).
- **2-of-3 behavioral rule** (signals 2–4) + temporal confirmation over *N* frames.
- Live WebSocket stream of annotated JPEG frames + stats JSON to the browser.
- React dashboard: video panel, stats sidebar, scrollable alerts feed.
- SQLite alert history with snapshot images, exposed via REST API.
- One-time 4-point homography calibration per camera for pixel → meter conversion.
- Optional Telegram bot notifications (photo + caption) on alert fire.
- Docker Compose deployment (backend + frontend).

### 5.2 Out of Scope (future versions)

- Multi-camera simultaneous monitoring with camera switching UI.
- Face recognition or person re-identification across cameras.
- Audio-based detection (screaming, glass breaking).
- Cloud deployment / multi-tenant SaaS.
- Mobile app for security guards.
- Integration with campus access-control or PA systems.
- Model fine-tuning on a custom campus dataset.

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Live Video   │  │ Stats Sidebar│  │   Alerts Feed     │  │
│  │  <img> from   │  │ People count │  │   REST GET +      │  │
│  │  WebSocket    │  │ Distances    │  │   WebSocket push  │  │
│  │  MJPEG stream │  │ Status badge │  │   (scrollable)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │             │
└─────────┼─────────────────┼────────────────────┼─────────────┘
          │  ws://          │  ws://             │  GET /api/
          ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND (Python)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │            Detection Engine (Background Task)         │    │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────────┐  │    │
│  │  │ Camera   │→│ YOLOv8   │→│ ByteTrack + Signal  │  │    │
│  │  │ Capture  │  │ -pose    │  │ Computation         │  │    │
│  │  │ (cv2)    │  │ (Ultra-  │  │ • Proximity (H)     │  │    │
│  │  │          │  │  lytics) │  │ • Wrist Swing       │  │    │
│  │  │          │  │          │  │ • Raised Arm        │  │    │
│  │  │          │  │          │  │ • Fall Posture      │  │    │
│  │  │          │  │          │  │ • Temporal Confirm  │  │    │
│  │  └─────────┘  └──────────┘  └────────┬────────────┘  │    │
│  │                                       │               │    │
│  │                          ┌────────────▼────────────┐  │    │
│  │                          │   Homography Module     │  │    │
│  │                          │   (4-pt → real meters)  │  │    │
│  │                          └─────────────────────────┘  │    │
│  └───────────────────────┬───────────────────────────────┘    │
│                          │                                    │
│          ┌───────────────┼───────────────┐                    │
│          ▼               ▼               ▼                    │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐            │
│  │  WebSocket   │ │  SQLite    │ │  Telegram    │            │
│  │  Broadcaster │ │  (SQLAlchemy)│ │  Bot Sender │            │
│  │  (frames +   │ │  alerts    │ │  (optional)  │            │
│  │   stats JSON)│ │  table     │ │              │            │
│  └──────────────┘ └────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend framework | FastAPI | 0.115+ |
| ASGI server | Uvicorn | 0.30+ |
| ML inference | Ultralytics YOLOv8-pose | 8.3+ |
| Object tracking | ByteTrack (via Ultralytics) | built-in |
| Computer vision | OpenCV (headless) | 4.10+ |
| Database | SQLite via SQLAlchemy 2.0 (async) | 2.0+ |
| Real-time transport | WebSocket (native FastAPI) | — |
| Frontend framework | React | 18.3+ |
| Build tool | Vite | 5.4+ |
| Styling | Tailwind CSS | 3.4+ |
| Notifications | Telegram Bot API (HTTP) | — |
| Containerization | Docker + Docker Compose | 24+ / 2.20+ |
| Language | Python 3.11 / Node 20 | — |

---

## 7. Functional Requirements

### FR-1: Video Ingestion

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | System shall accept a camera source as an integer (webcam index) or string (RTSP URL / file path) via `CAMERA_SOURCE` env var. | P0 |
| FR-1.2 | System shall read frames at the camera's native FPS (capped at 30 FPS for inference). | P0 |
| FR-1.3 | If the camera source is unavailable, the system shall log an error and retry every 5 seconds without crashing. | P1 |

### FR-2: Pose Detection & Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | System shall run YOLOv8-pose inference on each frame to extract 17 COCO keypoints per detected person. | P0 |
| FR-2.2 | System shall use ByteTrack (via Ultralytics `track` API) to assign persistent IDs across frames. | P0 |
| FR-2.3 | System shall annotate each frame with bounding boxes, keypoint skeletons, track IDs, and signal indicators before streaming. | P0 |

### FR-3: Detection Signals

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 **Proximity** | For every unique pair of tracked persons, compute the distance between their foot points (bottom-center of bounding box). If homography is calibrated, report in meters; otherwise report in pixels with a "not calibrated" flag. | P0 |
| FR-3.2 **Wrist-swing speed** | Compute the angular velocity of each person's wrist keypoints (left and right) relative to their shoulder over the last *K* frames. Flag if velocity exceeds a tunable threshold. | P0 |
| FR-3.3 **Raised arm** | Flag if either wrist keypoint is above the corresponding shoulder keypoint for ≥ *M* consecutive frames. | P0 |
| FR-3.4 **Fall posture** | Flag if a person's bounding-box aspect ratio (width/height) exceeds a tunable threshold (indicating horizontal orientation) for ≥ *M* frames. | P0 |
| FR-3.5 **Temporal confirmation** | An alert shall fire only when **proximity < threshold** AND **≥ 2 of 3 behavioral signals** (FR-3.2, FR-3.3, FR-3.4) are active for ≥ *N* consecutive frames. | P0 |
| FR-3.6 | All thresholds (*distance, velocity, N, M, K*) shall be configurable via a central config object without code changes. | P1 |

### FR-4: Homography Calibration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | System shall provide a calibration mode where the user clicks 4 points on the video frame corresponding to known real-world floor coordinates (in meters). | P1 |
| FR-4.2 | System shall compute a 3×3 homography matrix from the 4 point-pairs using `cv2.getPerspectiveTransform`. | P1 |
| FR-4.3 | The homography shall be stored per `camera_id` in the database and loaded on startup. | P1 |
| FR-4.4 | When calibrated, each person's foot point shall be transformed to real-world (x, y) in meters before distance computation. | P1 |
| FR-4.5 | When not calibrated, the dashboard shall display a visible "⚠ Not Calibrated — distances in pixels" indicator. | P1 |

### FR-5: Live Streaming (WebSocket)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | System shall expose a WebSocket endpoint (`/ws/live`) that pushes messages to all connected clients. | P0 |
| FR-5.2 | Each WebSocket message shall be a JSON object containing: `frame` (base64-encoded annotated JPEG), `stats` (people count, per-pair distances, active signals, overall status), and `timestamp`. | P0 |
| FR-5.3 | Frame rate over WebSocket shall be throttled to ≤ 15 FPS to conserve bandwidth. | P1 |
| FR-5.4 | When a new alert fires, the WebSocket shall also push an `alert` event so the frontend can update the feed without polling. | P0 |

### FR-6: Alert History (REST)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | System shall persist each alert to SQLite with: id, timestamp, camera_id, snapshot_path, reason (JSON of triggered signals), people_count. | P0 |
| FR-6.2 | System shall save the annotated frame at the moment of alert as a JPEG in the `snapshots/` directory. | P0 |
| FR-6.3 | `GET /api/alerts` shall return a paginated list of alerts (newest first). | P0 |
| FR-6.4 | `GET /api/alerts/{id}` shall return a single alert's details. | P0 |
| FR-6.5 | `GET /api/alerts/{id}/snapshot` shall serve the snapshot image. | P0 |

### FR-7: Telegram Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | When an alert fires and `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` are set, the system shall send a photo (snapshot) with a caption (reason, timestamp, people count) to the configured Telegram chat. | P1 |
| FR-7.2 | If env vars are not set, the notification step shall silently no-op (no errors, no crashes). | P0 |
| FR-7.3 | Telegram sends shall be non-blocking (fire-and-forget via async task) so they do not delay the detection loop. | P1 |

### FR-8: Dashboard Frontend

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | Dashboard shall display a live video panel fed by the WebSocket MJPEG stream. | P0 |
| FR-8.2 | Dashboard shall display a stats sidebar with: people count, overall status badge (SAFE / WARNING / DANGER), and live distance readouts between tracked pairs. | P0 |
| FR-8.3 | Dashboard shall display a scrollable alerts feed fetched from `GET /api/alerts` on load and updated live via WebSocket `alert` events. | P0 |
| FR-8.4 | Each alert card shall show: thumbnail snapshot, timestamp, reason text, and people count. | P0 |
| FR-8.5 | Dashboard shall show a "Calibrated ✓" or "Not Calibrated ⚠" indicator based on the stats payload. | P1 |
| FR-8.6 | Dashboard shall include a calibration overlay mode where the user can click 4 floor points on the video frame (Phase 4). | P2 |

---

## 8. Data Model

### Table: `alerts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique alert identifier |
| `timestamp` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When the alert fired (UTC) |
| `camera_id` | VARCHAR(64) | NOT NULL, DEFAULT 'cam_01' | Logical camera identifier |
| `snapshot_path` | VARCHAR(512) | NOT NULL | Relative path to the JPEG snapshot |
| `reason` | JSON | NOT NULL | Object describing which signals triggered, e.g. `{"proximity": 0.82, "wrist_swing": true, "raised_arm": true, "fall": false}` |
| `people_count` | INTEGER | NOT NULL | Number of tracked persons at alert time |

### Table: `calibrations` (Phase 4)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | |
| `camera_id` | VARCHAR(64) | UNIQUE, NOT NULL | One calibration per camera |
| `src_points` | JSON | NOT NULL | 4×2 pixel coordinates clicked by user |
| `dst_points` | JSON | NOT NULL | 4×2 real-world meter coordinates |
| `homography_matrix` | JSON | NOT NULL | 3×3 flattened matrix |
| `created_at` | DATETIME | NOT NULL | |

---

## 9. API Specification

### REST Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/` | Service info | `{"service": "campus-guardian", "status": "ok"}` |
| `GET` | `/api/health` | Health check with config summary | `{"status", "camera_source", "telegram_enabled"}` |
| `GET` | `/api/alerts?limit=20&offset=0` | Paginated alert list | `{"alerts": [...], "total": N}` |
| `GET` | `/api/alerts/{id}` | Single alert detail | `{alert object}` |
| `GET` | `/api/alerts/{id}/snapshot` | Serve snapshot JPEG | `image/jpeg` |
| `POST` | `/api/calibrate` | Submit 4-point calibration (Phase 4) | `{"status": "ok", "camera_id": "..."}` |
| `GET` | `/api/calibrate/{camera_id}` | Get current calibration (Phase 4) | `{calibration object}` or 404 |

### Response Example — `GET /api/alerts`

```json
{
  "total": 42,
  "alerts": [
    {
      "id": 42,
      "timestamp": "2025-07-11T10:42:18Z",
      "camera_id": "cam_01",
      "snapshot_path": "snapshots/alert_42.jpg",
      "reason": {
        "proximity_m": 0.82,
        "wrist_swing": true,
        "raised_arm": true,
        "fall": false,
        "signals_active": 2,
        "frames_confirmed": 7
      },
      "people_count": 3
    }
  ]
}
```

---

## 10. WebSocket Protocol

### Endpoint: `ws://<host>:8000/ws/live`

**Server → Client message format** (JSON, sent ~15× per second):

```json
{
  "type": "frame",
  "timestamp": 1720695738.123,
  "frame": "<base64-encoded JPEG>",
  "stats": {
    "people_count": 3,
    "status": "DANGER",
    "calibrated": true,
    "pairs": [
      {"id_a": 1, "id_b": 2, "distance": 0.82, "unit": "m"},
      {"id_a": 1, "id_b": 3, "distance": 2.41, "unit": "m"},
      {"id_a": 2, "id_b": 3, "distance": 1.95, "unit": "m"}
    ],
    "signals": {
      "wrist_swing": {"active": true, "person_ids": [2]},
      "raised_arm": {"active": true, "person_ids": [2]},
      "fall": {"active": false, "person_ids": []}
    }
  }
}
```

**Server → Client alert event** (sent once per alert):

```json
{
  "type": "alert",
  "alert": {
    "id": 42,
    "timestamp": "2025-07-11T10:42:18Z",
    "camera_id": "cam_01",
    "snapshot_url": "/api/alerts/42/snapshot",
    "reason": { "proximity_m": 0.82, "signals_active": 2 },
    "people_count": 3
  }
}
```

---

## 11. UI / UX Specification

### Layout (1920 × 1080 target)

```
┌──────────────────────────────────────────────────────────────────┐
│  🛡️ CAMPUS GUARDIAN          AI Proximity & Violence Detection  │
│                                          [● SYSTEM ACTIVE]     │
├───────────────────────────────────────┬──────────────────────────┤
│                                       │  REAL-TIME RISK METRICS │
│                                       │  ┌──────┐ ┌────┐ ┌────┐│
│         LIVE CAMERA FEED              │  │ RISK │ │ ppl│ │dist││
│         (annotated MJPEG)             │  │ HIGH │ │  3 │ │0.8m││
│                                       │  └──────┘ └────┘ └────┘│
│    ┌──────┐      ┌──────┐            │  Signal Breakdown:       │
│    │ ID:1 │------│ ID:2 │  0.82m ⚠️  │  ⚠ Wrist Swing DETECTED  │
│    └──────┘      └──────┘            │  ⚠ Raised Arm DETECTED   │
│                                       │  ✓ Fall Posture NORMAL  │
│          [📐 Calibrate Floor]         │                          │
├───────────────────────────────────────┤                          │
│  CALIBRATION & ENGINE STATUS          ├──────────────────────────┤
│  ✓ Homography Active                  │  INCIDENT & ALERT FEED   │
│  YOLOv8-pose + ByteTrack | 28 FPS    │  ┌─────────────────────┐ │
│  Telegram: ✓ Connected               │  │ 🔴 AGGRESSIVE       │ │
│                                       │  │    0.82m | Just now │ │
│                                       │  ├─────────────────────┤ │
│                                       │  │ 🟡 PROXIMITY WARN   │ │
│                                       │  │    1.12m | 4m ago   │ │
│                                       │  ├─────────────────────┤ │
│                                       │  │ 🟡 FALL DETECTED    │ │
│                                       │  │    Person 05 | 12m  │ │
│                                       │  └─────────────────────┘ │
└───────────────────────────────────────┴──────────────────────────┘
```

### Color Palette (Tailwind)

| Token | Hex | Usage |
|-------|-----|-------|
| Canvas BG | `#020617` | App background |
| Panel Surface | `#0f172a` | Card containers |
| Subcard | `#1e293b` | Metric tiles |
| Border | `#334155` | Panel edges |
| Primary | `#38bdf8` | Brand, tracking IDs |
| Danger | `#ef4444` | Alerts, violent signals |
| Warning | `#f59e0b` | Proximity approaching |
| Success | `#10b981` | Safe status, calibrated |

---

## 12. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | **Performance** | End-to-end inference latency per frame | ≤ 50 ms on GPU, ≤ 120 ms on CPU |
| NFR-2 | **Throughput** | Sustained processing rate | ≥ 15 FPS on CPU (laptop), ≥ 25 FPS on GPU |
| NFR-3 | **Latency** | Alert-to-dashboard notification | < 2 seconds |
| NFR-4 | **Reliability** | Uptime during a 1-hour demo | 100% (no crashes) |
| NFR-5 | **Portability** | Runs on Linux, macOS (native backend), Windows (Docker) | All three |
| NFR-6 | **Security** | No hardcoded secrets; all credentials via env vars | Required |
| NFR-7 | **Privacy** | No face data stored; snapshots are pose-annotated frames only | Required |
| NFR-8 | **Scalability** | v1.0 supports 1 camera; architecture should not preclude multi-camera | Design constraint |
| NFR-9 | **Usability** | Non-technical user can start the system with one command | `docker compose up` |

---

## 13. Deployment & Infrastructure

### Docker Compose Services

| Service | Image Base | Ports | Volumes | Notes |
|---------|-----------|-------|---------|-------|
| `backend` | `python:3.11-slim` | `8000:8000` | `./backend/data`, `./backend/snapshots` | Optional `/dev/video0` device mount for webcam |
| `frontend` | `node:20-alpine` (multi-stage) | `5173:5173` | — | Serves built Vite app via `vite preview` |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CAMERA_SOURCE` | Yes | `0` | Webcam index or RTSP URL |
| `SQLITE_PATH` | No | `data/campus_guardian.db` | Database file path |
| `SNAPSHOTS_DIR` | No | `snapshots` | Alert snapshot directory |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token (enables notifications) |
| `TELEGRAM_CHAT_ID` | No | — | Telegram chat/group ID |
| `HOST` | No | `0.0.0.0` | Bind address |
| `PORT` | No | `8000` | Bind port |
| `VITE_API_BASE` | Build-time | `http://localhost:8000` | Frontend API base URL |

### Hardware Requirements

| Tier | CPU | RAM | GPU | Expected FPS |
|------|-----|-----|-----|-------------|
| Minimum (demo) | 4-core x86 | 8 GB | None | ~10–15 |
| Recommended | 6-core x86 | 16 GB | NVIDIA GTX 1660+ | ~25–30 |

---

## 14. Phased Delivery Plan

| Phase | Deliverable | Key Milestone | Status |
|-------|-------------|---------------|--------|
| **Phase 0** | Repo restructure, Docker skeleton, health endpoints | `docker compose up` → frontend shows backend health JSON | ✅ Complete |
| **Phase 1** | Port `pose_risk_engine.py` into `backend/app/detection/` as a module with background run loop | Backend logs detections to console; stats dict generated per frame | 🔲 Next |
| **Phase 2** | WebSocket live video + stats to React dashboard | Browser shows annotated live feed + people count + distances | 🔲 |
| **Phase 3** | SQLite alerts + REST endpoints + alerts feed UI | Past alerts visible in dashboard; snapshots viewable | 🔲 |
| **Phase 4** | Homography calibration flow (4-point click → real meters) | Dashboard shows distances in meters; "Calibrated ✓" badge | 🔲 |
| **Phase 5** | Telegram notifications | Alert photo + caption arrives in Telegram chat | 🔲 |
| **Phase 6** | Polish, README demo script, competition dry-run | Full 5-minute demo flow works flawlessly | 🔲 |

---

## 15. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | YOLOv8-pose too slow on CPU for real-time demo | Medium | High | Use `yolov8n-pose` (nano) model; reduce input resolution to 640×480; skip frames if needed. |
| R2 | Webcam not accessible inside Docker (macOS/Windows) | High | Medium | Run backend natively during demo; document limitation; support RTSP/file fallback. |
| R3 | False positives during live demo embarrass the team | Medium | High | Tune temporal confirmation *N* higher for demo (e.g., N=10); pre-test with the actual demo environment lighting. |
| R4 | WebSocket disconnects during demo | Low | Medium | Frontend auto-reconnects with exponential backoff; show "Reconnecting…" overlay. |
| R5 | Telegram API rate-limits or bot token revoked | Low | Low | Notifications are optional; system functions fully without them. |
| R6 | Homography inaccurate due to poor point selection | Medium | Medium | Show visual overlay of projected grid so user can verify; allow re-calibration. |
| R7 | SQLite write contention under rapid alerts | Low | Low | Use WAL mode; batch writes if needed; alert cooldown of 5 seconds per pair. |

---

## 16. Appendices

### Appendix A: Demo Script (for Live Judging — 5 minutes)

| Time | Action | What Judges See |
|------|--------|-----------------|
| 0:00 | Open dashboard; show empty courtyard feed | Clean UI, live video, "SAFE" badge, 0 people |
| 0:30 | Walk into frame alone | Person count → 1, skeleton overlay appears, "SAFE" |
| 1:00 | Second person walks in, stands far away | Person count → 2, distance shown in meters, "SAFE" |
| 1:30 | **Calibration demo:** click 4 floor tiles | Grid overlay appears, distances switch from px → m |
| 2:00 | Two people walk close together (< 1 m) | Distance drops, "WARNING" badge, proximity line turns yellow |
| 2:30 | One person raises arm aggressively + swings | "DANGER" badge, red bounding boxes, alert fires |
| 3:00 | Show alert appearing in feed + Telegram notification on phone | End-to-end pipeline demonstrated |
| 3:30 | Person "falls" (lies down) | Fall signal triggers, separate alert |
| 4:00 | Scroll through alerts feed; click a snapshot | Historical data persistence demonstrated |
| 4:30 | Show architecture slide / code structure | Technical depth for judges |
| 5:00 | Q&A | — |

### Appendix B: Detection Signal Logic (Preserved from Original)

The detection engine preserves the exact tuned logic from the original `pose_risk_engine.py`:

1. **Proximity:** Euclidean distance between foot points of each tracked pair. Threshold: configurable (default 1.5 m calibrated / 150 px uncalibrated).
2. **Wrist-swing speed:** `atan2(dy, dx)` of wrist relative to shoulder across *K*=5 frames. Threshold: > 0.3 rad/frame.
3. **Raised arm:** `wrist_y < shoulder_y` (image coordinates, y-down) for ≥ *M*=5 frames.
4. **Fall posture:** `bbox_width / bbox_height > 1.2` for ≥ *M*=5 frames.
5. **Alert rule:** `proximity < threshold` AND `sum([swing, raised, fall]) >= 2` for ≥ *N*=5 consecutive frames.
6. **Cooldown:** After an alert fires for a pair, suppress further alerts for that pair for 5 seconds.

### Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **YOLOv8-pose** | Ultralytics' real-time pose estimation model outputting 17 COCO keypoints per person |
| **ByteTrack** | Multi-object tracking algorithm that associates detections across frames using motion + appearance |
| **Homography** | A 3×3 projective transformation matrix mapping pixel coordinates to real-world planar coordinates |
| **Temporal confirmation** | Requiring a signal to persist for N consecutive frames before triggering an alert, reducing false positives |
| **MJPEG** | Motion JPEG; a stream of individual JPEG frames (used here over WebSocket as base64) |
| **WAL mode** | SQLite Write-Ahead Logging; allows concurrent reads during writes |

---

*End of PRD — Campus Guardian v1.0*
