import clsx from 'clsx'
import { humanize } from '../lib/format'

const tone: Record<string, string> = {
  draft: 'bg-slate-100 text-ink-soft dark:bg-white/10 dark:text-slate-300',
  new: 'bg-slate-100 text-ink-soft dark:bg-white/10 dark:text-slate-300',
  planned: 'bg-slate-100 text-ink-soft dark:bg-white/10 dark:text-slate-300',
  submitted: 'bg-amber-50 text-amber-700', pending: 'bg-amber-50 text-amber-700', open: 'bg-amber-50 text-amber-700',
  overdue: 'bg-bad-50 text-bad', waiting_spares: 'bg-amber-50 text-amber-700',
  rejected: 'bg-bad-50 text-bad', cancelled: 'bg-bad-50 text-bad', lost: 'bg-bad-50 text-bad', failed: 'bg-bad-50 text-bad',
  approved: 'bg-steel-50 text-steel-700', sent: 'bg-steel-50 text-steel-700', released: 'bg-steel-50 text-steel-700',
  running: 'bg-steel-50 text-steel-700', in_production: 'bg-steel-50 text-steel-700', in_progress: 'bg-steel-50 text-steel-700',
  loading: 'bg-steel-50 text-steel-700', in_transit: 'bg-steel-50 text-steel-700', in_stock: 'bg-steel-50 text-steel-700',
}
const done = /^(posted|received|ordered|dispatched|delivered|completed|done|won|accepted|resolved|closed|billed|passed|consumed|irn_generated|posted_to_tally|invoiced|loaded)$/

export function StatusPill({ value }: { value: string | null | undefined }) {
  if (!value) return null
  const cls = tone[value] ?? (done.test(value) ? 'bg-ok-50 text-ok' : 'bg-slate-100 text-ink-soft')
  return <span className={clsx('inline-flex h-6 items-center rounded px-2 text-xs font-medium whitespace-nowrap', cls)}>{humanize(value)}</span>
}
