import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { fmt, humanize } from '../lib/format'
import { useMe } from '../lib/me'

type Summary = {
  kpis: Record<string, number>
  pipeline: { stage: string; n: number; value: number }[]
}

const STAGES = ['new', 'contacted', 'quoted', 'negotiation', 'won', 'lost']

export default function Dashboard() {
  const { data: me } = useMe()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Summary>('/dashboard/summary'), refetchInterval: 60_000 })
  const k = data?.kpis ?? {}
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const strip = [
    { label: 'Stock value', value: fmt.rupees(k.stock_value ?? 0), to: '/stores/stock' },
    { label: 'Coil stock', value: fmt.mt(k.coil_mt ?? 0), sub: `${k.open_coils ?? 0} coils`, to: '/stores/coils' },
    { label: 'Open sales orders', value: fmt.num(k.open_orders ?? 0), to: '/sales/orders' },
    { label: 'Job cards today', value: fmt.num(k.jobs_today ?? 0), to: '/production/job-cards' },
    { label: 'Dispatches today', value: fmt.num(k.dispatches_today ?? 0), to: '/dispatch/dispatches' },
  ]
  const attention = [
    { n: k.my_approvals ?? 0, text: 'documents waiting for your approval', to: '/purchase/indents?status=submitted' },
    { n: k.indents_pending ?? 0, text: 'indents submitted and not yet approved', to: '/purchase/indents?status=submitted' },
    { n: k.tally_pending ?? 0, text: 'entries not yet posted to Tally', to: '/admin/tally' },
    { n: k.open_breakdowns ?? 0, text: 'machines down or under repair', to: '/maintenance/breakdowns' },
  ].filter(a => a.n > 0)
  const pipe = STAGES.map(s => data?.pipeline.find(p => p.stage === s) ?? { stage: s, n: 0, value: 0 })
  const maxN = Math.max(1, ...pipe.map(p => p.n))

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      <h1 className="text-2xl font-semibold">{hello}, {me?.full_name.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-ink-soft dark:text-slate-400">{today}</p>

      <section aria-label="Plant at a glance" className="panel mt-6 grid grid-cols-2 divide-line md:grid-cols-5 md:divide-x dark:divide-white/10">
        {strip.map(s => (
          <Link key={s.label} to={s.to} className="group px-5 py-4 hover:bg-steel-50/60 dark:hover:bg-white/[.03]">
            <div className="text-xs text-ink-faint">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${isLoading ? 'text-ink-faint' : ''}`}>{s.value}</div>
            {s.sub && <div className="text-xs text-ink-soft dark:text-slate-400">{s.sub}</div>}
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft dark:text-slate-400"><CheckCircle2 size={16} className="text-ok" /> Nothing is waiting on anyone right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line dark:divide-white/10">
              {attention.map(a => (
                <li key={a.text}><Link to={a.to} className="flex items-center gap-3 py-2.5 text-sm hover:text-steel">
                  <AlertTriangle size={15} className="text-amber" /><span className="font-semibold">{a.n}</span> {a.text}</Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Sales pipeline</h2>
            <Link to="/sales/enquiries" className="text-xs text-steel hover:underline">All enquiries</Link>
          </div>
          <div className="mt-4 space-y-2">
            {pipe.map(p => (
              <div key={p.stage} className="grid grid-cols-[96px_1fr_32px_88px] items-center gap-3 text-sm">
                <span className="text-ink-soft dark:text-slate-400">{humanize(p.stage)}</span>
                <div className="h-2 rounded-full bg-steel-50 dark:bg-white/5">
                  <div className={`h-2 rounded-full ${p.stage === 'lost' ? 'bg-zinc-logo' : 'bg-steel'}`} style={{ width: `${(p.n / maxN) * 100}%` }} />
                </div>
                <span className="text-right font-medium">{p.n}</span><span className="text-right text-ink-soft dark:text-slate-400">{fmt.rupees(p.value)}</span>
              </div>
            ))}
          </div>
          {pipe.every(p => p.n === 0) && <p className="mt-4 text-xs text-ink-faint">Enquiries start flowing in Phase 2, when the sales module goes live.</p>}
        </section>
      </div>
    </div>
  )
}
