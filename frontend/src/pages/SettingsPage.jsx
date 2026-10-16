import { useState } from 'react'
import { prefs, usePrefs } from '../utils/prefs.js'
import { playAlertTone } from '../utils/sound.js'

function Switch({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-teal-500' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function Row({ title, text, children }) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{text}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/* Settings page — the only place with the light/dark toggle. */
export default function SettingsPage({ slots, onTestAlert }) {
  const p = usePrefs()
  const sourceSlots = slots.filter((s) => s.kind === 'source')
  const [testCam, setTestCam] = useState('')

  function toggleTheme() {
    const theme = p.theme === 'dark' ? 'light' : 'dark'
    prefs.set({ theme })
    document.documentElement.dataset.theme = theme
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Preferences</p>
        <h2 className="mt-1 text-lg font-bold">Settings</h2>
        <p className="mt-1 text-xs text-slate-400">Control how the operations dashboard behaves.</p>
      </div>

      <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        <Row title="Appearance" text="Switch between light and dark mode.">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-800"
          >
            {p.theme === 'dark' ? '☀️ Use light mode' : '🌙 Use dark mode'}
          </button>
        </Row>

        <Row title="Alert sound" text="Play a short tone when a new alert arrives.">
          <Switch
            on={p.sound}
            onToggle={() => {
              const sound = !p.sound
              prefs.set({ sound })
              if (sound) playAlertTone()
            }}
          />
        </Row>

        <Row
          title="Automatic alert pop-up"
          text="Open the alert panel the moment violence is detected on any camera."
        >
          <Switch on={p.autoPopup} onToggle={() => prefs.set({ autoPopup: !p.autoPopup })} />
        </Row>

        <Row
          title="Test alert"
          text="Rehearse the response flow: pop-up and sound, without saving a record."
        >
          <select
            value={testCam || sourceSlots[0]?.id || ''}
            onChange={(e) => setTestCam(e.target.value)}
            className="max-w-[160px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs"
          >
            {sourceSlots.length === 0 && <option value="">No camera connected</option>}
            {sourceSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => onTestAlert(testCam || sourceSlots[0]?.id)}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-500"
          >
            Trigger test alert
          </button>
        </Row>

        <Row
          title="Interface preferences"
          text="Camera names, reviewed flags and these settings are stored in this browser. Incident records stay safe on the server."
        >
          <button
            onClick={() => {
              if (window.confirm('Reset camera names, reviewed flags and settings on this device? Incident records on the server are not touched.')) {
                prefs.reset()
                document.documentElement.dataset.theme = prefs.get().theme
              }
            }}
            className="rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950"
          >
            Reset preferences
          </button>
        </Row>
      </div>

      <p className="text-[11px] text-slate-600">
        Real-time violence detection runs on the Python detection server; this dashboard renders its
        live feeds, alerts and evidence.
      </p>
    </div>
  )
}