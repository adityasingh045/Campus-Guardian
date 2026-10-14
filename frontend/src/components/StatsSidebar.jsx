// function StatRow({ label, value, highlight }) {
//   return (
//     <div className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
//       <span className="text-sm text-slate-400">{label}</span>
//       <span className={`text-sm font-medium ${highlight && value > 0 ? 'text-red-400' : 'text-slate-100'}`}>{value}</span>
//     </div>
//   )
// }

// export default function StatsSidebar({ stats }) {
//   const s = stats || { person_count: 0, active_signals: { proximity: 0, swing: 0, arm: 0, fall: 0 } }
//   return (
//     <div className="bg-slate-900 rounded-lg p-4">
//       <h2 className="text-sm font-semibold text-slate-300 mb-2">Live Stats</h2>
//       <StatRow label="People detected" value={s.person_count ?? 0} />
//       <StatRow label="Proximity flags" value={s.active_signals?.proximity ?? 0} highlight />
//       <StatRow label="Swing flags" value={s.active_signals?.swing ?? 0} highlight />
//       <StatRow label="Arm raise flags" value={s.active_signals?.arm ?? 0} highlight />
//       <StatRow label="Fall flags" value={s.active_signals?.fall ?? 0} highlight />
//     </div>
//   )
// }
