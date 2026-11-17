import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react'
import clsx from 'clsx'
import type { ListDef } from '../nav'
import { api, can } from '../lib/api'
import type { Page } from '../lib/api'
import { fmt, humanize } from '../lib/format'
import { useMe } from '../lib/me'
import { DataGrid } from '../components/DataGrid'

export default function ListPage({ def }: { def: ListDef }) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const sort = params.get('sort') ?? undefined
  const page = Number(params.get('page') ?? 1)
  const [text, setText] = useState(q)
  const { data: me } = useMe()

  useEffect(() => setText(q), [q, def.id])
  useEffect(() => {                                  // debounce typing into the URL (and so the query)
    const t = setTimeout(() => { if (text !== q) set({ q: text || null, page: null }) }, 220)
    return () => clearTimeout(t)
  }) // eslint-disable-line

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const qs = new URLSearchParams({ page: String(page), size: '50', ...(q && { q }), ...(status && { status }), ...(sort && { sort }) })
  const { data, isFetching, isError } = useQuery({
    queryKey: ['list', def.endpoint, qs.toString()],
    queryFn: () => api<Page<Record<string, unknown>>>(`${def.endpoint}?${qs}`),
    placeholderData: keepPreviousData,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  const canCreate = can(me, def.module, 'create')
  const filtered = Boolean(q || status)

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{def.label}</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-slate-400">{data ? `${fmt.num(data.total)} ${data.total === 1 ? def.singular : 'records'}` : ' '}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-outline" disabled title="Excel export arrives with the first records"><Download size={15} /> Export</button>
          {canCreate && def.phase > 0 && !def.noCreate && (
            <button className="btn-primary" disabled title={`Creating a ${def.singular} opens in Phase ${def.phase}`}>
              <Plus size={16} /> New {def.singular}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search {def.label}</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="field pl-9" placeholder={`Search ${def.label.toLowerCase()}`} value={text} onChange={e => setText(e.target.value)} />
        </label>
        {def.statuses && (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
            {['', ...def.statuses].map(s => (
              <button key={s || 'all'} onClick={() => set({ status: s || null, page: null })}
                className={clsx('h-8 rounded-md px-2.5 text-[13px] transition-colors',
                  status === s ? 'bg-navy text-white' : 'text-ink-soft hover:bg-steel-50 dark:text-slate-300 dark:hover:bg-white/5')}>
                {s ? humanize(s) : 'All'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel mt-4 overflow-hidden">
        {isError ? (
          <p className="px-6 py-10 text-sm text-bad">This list could not load. Refresh the page; if it keeps failing, tell IT.</p>
        ) : data && data.total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <def.icon size={28} strokeWidth={1.5} className="text-steel-400" />
            {filtered ? (<>
              <p className="mt-3 font-medium">Nothing matches these filters</p>
              <button className="btn-quiet mt-2" onClick={() => { setText(''); set({ q: null, status: null, page: null }) }}>Clear filters</button>
            </>) : (<>
              <p className="mt-3 font-medium">No {def.label.toLowerCase()} yet</p>
              <p className="mt-1 max-w-md text-sm text-ink-soft dark:text-slate-400">{def.empty}</p>
              {def.phase > 0 && <p className="mt-3 text-xs text-ink-faint">Goes live in Phase {def.phase}.</p>}
            </>)}
          </div>
        ) : (
          <DataGrid columns={def.columns} rows={data?.rows ?? []} sort={sort} loading={isFetching}
            onSort={s => set({ sort: s ?? null, page: null })} />
        )}
        {data && data.total > data.size && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2 text-sm dark:border-white/10">
            <span className="text-ink-faint">Page {page} of {pages}</span>
            <button className="btn-quiet px-2" aria-label="Previous page" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}><ChevronLeft size={16} /></button>
            <button className="btn-quiet px-2" aria-label="Next page" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
