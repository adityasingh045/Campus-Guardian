const STYLES = {
  SAFE: 'bg-emerald-900 text-emerald-300',
  WARNING: 'bg-amber-900 text-amber-300',
  DANGER: 'bg-red-900 text-red-300 animate-pulse',
  UNKNOWN: 'bg-slate-800 text-slate-400',
}

export default function StatusBadge({ status = 'UNKNOWN' }) {
  const style = STYLES[status] || STYLES.UNKNOWN
  return <span className={`text-xs font-medium px-2 py-1 rounded-full ${style}`}>{status}</span>
}
