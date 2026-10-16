# Campus Guardian — Presentation Playbook (5-slot demo)

Goal: show investors/judges (1) real-time detection, (2) multi-camera
correlation of the SAME fight, and (3) that the system does NOT false-alarm
on friendly contact or normal crowds.

## The 5 slots

| Slot | source_id    | Feed                                   | Zone          | Expected result            |
|------|--------------|----------------------------------------|---------------|----------------------------|
| 1    | CAM-LIVE     | Live camera (webcam / Camo phone)      | —             | live monitoring            |
| 2    | CAM-FRIENDLY | Recorded: 2–3 people hug / shake hands | —             | **NO alert**               |
| 3    | CAM-CROWD    | Recorded: people roaming / standing    | —             | **NO alert**               |
| 4    | CAM-FIGHT-A  | Recorded fight video                   | Main Corridor | ONE alert                  |
| 5    | CAM-FIGHT-B  | Same fight, different angle            | Main Corridor | attaches as **angle** of 4 |

Slots 1–3 run from the start (put them in `backend/sources.json`, see
`demo/sources.demo.json`). Slots 4–5 are added **live on stage** with one
command — a real zero-downtime feature, not a trick.

## Before the presentation (do all of this days ahead)

1. **Record your clips** (phone, landscape, 30–60 s each, good lighting):
   - `fight.mp4` — your staged fight (you already have this).
   - `fight_angle2.mp4` — **best:** re-shoot the fight with TWO phones
     recording simultaneously from different corners. **Fallback:** generate
     a simulated second angle from the one video you have:
     `bash demo/make_angle2.sh /abs/path/fight.mp4`
   - `friendly_hugs_handshakes.mp4` — 2–3 friends hugging, shaking hands,
     high-fiving. Keep movements calm and natural.
   - `crowd_roaming.mp4` — several people walking around, standing in
     groups, chatting.

2. **REHEARSE THE NEGATIVE CLIPS — this is critical.** Hugging looks like
   grappling to any motion-based model, so a too-energetic hug CAN trigger a
   false positive. Run each clip through the system beforehand:
   - If the friendly clip triggers an alert, re-shoot it calmer (slower
     approach, brief hug, step apart) until it reliably passes.
   - Never show a negative clip on stage that you haven't verified at least
     twice. Pick your two cleanest takes.

3. **Set up slots 1–3** in `backend/sources.json` (copy from
   `demo/sources.demo.json`, fix the absolute paths), restart the backend,
   confirm all three tiles are live and that 10 minutes pass with zero
   alerts on slots 2–3.

4. **Dry-run the full script below at least twice.** Recorded videos loop
   automatically, so the fight re-triggers on every loop — that's fine, each
   loop re-demonstrates correlation.

## On stage — the script

1. Open the dashboard. Point at the three tiles:
   *"One live camera, and two feeds showing normal campus life — people
   hugging, shaking hands, crowds moving. Notice: zero alerts. The system
   understands the difference between contact and violence."*
   (Let this breathe for 20–30 seconds. Show the empty alert history.)

2. Run (from the repo root, terminal visible or hidden — your choice):

   ```bash
   bash demo/add_fight_cams.sh /abs/path/fight.mp4 /abs/path/fight_angle2.mp4
   ```

   *"We're now plugging two more cameras into the running system — no
   restart, no downtime. Both watch the same corridor."*

3. Two tiles appear instantly. Within seconds the fight is detected:
   - ONE siren/popup — not two. *"Both cameras saw the same fight. Older
     systems would fire two alarms; ours correlates them into one incident
     with two angles."*
   - Telegram pings on your phone (hold it up): main alert + angle
     follow-up.
   - Open the incident → show the "Other angles" section → click
     **Download PDF report**. *"One-click evidence pack for the principal
     or the police."*

4. Mark it reviewed, show it cascades to the angle too, then (optionally)
   show the Analytics page: *"multi-camera confirmations"* KPI just went up.

5. Cleanup between rehearsals: `bash demo/remove_fight_cams.sh`

## Honest answers if judges push (know these)

- *"How do you know it's the same fight on both cameras?"* — Zone + time
  correlation: cameras are mapped to physical zones; alerts in the same zone
  within the correlation window (default 45 s) merge into one incident.
  True cross-camera person re-identification is on the roadmap.
- *"Is the second angle real?"* — If you used `make_angle2.sh`, say the
  second feed *simulates* a second camera on the opposite wall; the
  correlation logic treats it exactly as it would a real camera. (Better:
  shoot with two phones and this question never comes up.)

## Troubleshooting

- `add_fight_cams.sh` says 409 → the camera already exists; run
  `remove_fight_cams.sh` first.
- Second camera raised its OWN alert instead of attaching as an angle →
  it fired outside the 45 s window; raise `INCIDENT_CORRELATION_SECONDS=90`
  in `backend/.env`, or shorten the dead time at the start of the videos.
- Tile shows the synthetic test pattern → the `uri` path is wrong; it must
  be an ABSOLUTE path to the video file.
