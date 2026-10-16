import SystemStatusBar from '../components/SystemStatusBar.jsx'
import CameraGrid from '../components/CameraGrid.jsx'

export default function DashboardPage({
  slots,
  framesBySource,
  incidents,
  camerasOnline,
  camerasTotal,
  activeIncidents,
  systemStatus,
  onOpenCamera,
}) {
  return (
    <div className="space-y-4">
      <SystemStatusBar
        camerasOnline={camerasOnline}
        camerasTotal={camerasTotal}
        activeIncidents={activeIncidents}
        systemStatus={systemStatus}
      />
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Live overview</p>
        <h2 className="mt-1 text-lg font-bold">Camera overview</h2>
        <p className="mt-1 text-xs text-slate-400">Tap a screen to open its full view.</p>
      </div>
      <CameraGrid
        slots={slots}
        framesBySource={framesBySource}
        incidents={incidents}
        onOpen={onOpenCamera}
      />
    </div>
  )
}