import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import type { Column } from '../nav'
import { fmt } from '../lib/format'
import { StatusPill } from './StatusPill'

type Row = Record<string, unknown>

export function DataGrid({ columns, rows, sort, onSort, loading }: {
  columns: Column[]; rows: Row[]; sort?: string; onSort?: (s: string | undefined) => void; loading?: boolean
}) {
  const [sortKey, sortDir] = (sort ?? '').split(':')
  const sorting: SortingState = sortKey ? [{ id: sortKey, desc: sortDir === 'desc' }] : []
  const defs: ColumnDef<Row>[] = columns.map(c => ({
    id: c.key, accessorKey: c.key, header: c.label, size: c.width,
    cell: info => {
      const v = info.getValue()
      if (c.status) return <StatusPill value={v as string} />
      return fmt[c.fmt ?? 'text'](v)
    },
  }))
  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel(), manualSorting: true, state: { sorting } })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white dark:bg-[#132033]">
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="border-b border-line dark:border-white/10">
              {hg.headers.map(h => {
                const col = columns.find(c => c.key === h.id)!
                const active = sortKey === h.id
                return (
                  <th key={h.id} style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                    className={clsx('h-10 px-3 text-left text-xs font-medium text-ink-faint whitespace-nowrap', col.align === 'right' && 'text-right')}>
                    <button type="button" className={clsx('inline-flex items-center gap-1 hover:text-ink dark:hover:text-white', active && 'text-ink dark:text-white')}
                      onClick={() => onSort?.(!active ? `${h.id}:asc` : sortDir === 'asc' ? `${h.id}:desc` : undefined)}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {active && (sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className={clsx(loading && 'opacity-60 transition-opacity')}>
          {table.getRowModel().rows.map(r => (
            <tr key={r.id} className="h-11 border-b border-line/70 last:border-0 hover:bg-steel-50/60 dark:border-white/5 dark:hover:bg-white/[.03] cursor-pointer">
              {r.getVisibleCells().map(cell => {
                const col = columns.find(c => c.key === cell.column.id)!
                return (
                  <td key={cell.id} className={clsx('px-3 whitespace-nowrap', col.align === 'right' && 'text-right', col.key === 'doc_no' && 'font-medium')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
