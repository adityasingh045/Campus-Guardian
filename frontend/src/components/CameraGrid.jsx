import CameraCard from './CameraCard.jsx'

/* Dashboard grid: real sources first, then reserved placeholder slots. */
export default function CameraGrid({ slots, framesBySource, incidents, onOpen }) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-500">
        No cameras yet. Add one from the Cameras page.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {slots.map((slot, index) => (
        <CameraCard
          key={slot.id}
          slot={slot}
          index={index}
          frame={slot.kind === 'source' ? framesBySource[slot.id] : null}
          lastIncident={
            slot.kind === 'source' ? incidents.find((i) => i.source_id === slot.id) : null
          }
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}