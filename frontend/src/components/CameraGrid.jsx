import CameraCard from "./CameraCard.jsx";
export default function CameraGrid({ sources, framesBySource }) {
  if (sources.length === 0) {
    return <div className="text-sm text-slate-500 p-4">No video sources configured. Add one in backend/sources.json.</div>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {sources.map((source) => (
        <CameraCard key={source.source_id} source={source} frame={framesBySource[source.source_id]} />
      ))}
    </div>
  )
}
