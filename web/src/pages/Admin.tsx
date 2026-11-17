import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DataGrid } from '../components/DataGrid'
import type { Column } from '../nav'

function Simple({ title, intro, endpoint, columns, empty }: { title: string; intro: string; endpoint: string; columns: Column[]; empty: string }) {
  const { data, isError } = useQuery({ queryKey: ['admin', endpoint], queryFn: () => api<Record<string, unknown>[]>(endpoint) })
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft dark:text-slate-400">{intro}</p>
      <div className="panel mt-5 overflow-hidden">
        {isError ? <p className="px-6 py-10 text-sm text-bad">You do not have access to this page, or it could not load.</p>
          : data && data.length === 0 ? <p className="px-6 py-12 text-center text-sm text-ink-soft">{empty}</p>
          : <DataGrid columns={columns} rows={(data ?? []).map(r => ({ ...r, roles: Array.isArray(r.roles) ? (r.roles as string[]).join(', ') : r.roles }))} />}
      </div>
    </div>
  )
}

export const Users = () => <Simple title="Users and roles" endpoint="/admin/users"
  intro="People who can sign in to Crayon ERP and what each role lets them do. Accounts are normally created from the group app hub."
  empty="No users yet."
  columns={[{ key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'employee_code', label: 'Employee code' },
    { key: 'roles', label: 'Roles' }, { key: 'last_login_at', label: 'Last sign-in', fmt: 'dateTime' }, { key: 'is_active', label: 'Active', fmt: 'bool' }]} />

export const TallySync = () => <Simple title="Tally sync" endpoint="/tally/monitor"
  intro="Every purchase bill, sales invoice and note the ERP sends to TallyPrime. The connector on the Tally PC posts pending entries every 60 seconds."
  empty="Nothing has been sent to Tally yet. Entries appear here once bills and invoices are passed."
  columns={[{ key: 'id', label: 'Entry' }, { key: 'entity', label: 'Document', fmt: 'label' }, { key: 'voucher_type', label: 'Voucher type' },
    { key: 'status', label: 'Status', status: true }, { key: 'attempts', label: 'Attempts', align: 'right' },
    { key: 'tally_voucher_no', label: 'Tally voucher' }, { key: 'last_error', label: 'Error' }, { key: 'created_at', label: 'Queued', fmt: 'dateTime' }]} />

export const Audit = () => <Simple title="Audit log" endpoint="/admin/audit"
  intro="Every sign-in, change, approval and cancellation, newest first."
  empty="No activity recorded yet."
  columns={[{ key: 'at', label: 'When', fmt: 'dateTime' }, { key: 'full_name', label: 'User' }, { key: 'action', label: 'Action', fmt: 'label' },
    { key: 'entity', label: 'Record', fmt: 'label' }, { key: 'entity_id', label: 'Id', align: 'right' }]} />
