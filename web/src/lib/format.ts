/** 'partly_received' -> 'Partly received' */
export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })
const money = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const dateF = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeF = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmt = {
  num: (v: unknown) => (v === null || v === undefined || v === '' ? '' : num.format(Number(v))),
  rupees: (v: unknown) => (v === null || v === undefined || v === '' ? '' : `₹${money.format(Number(v))}`),
  mt: (v: unknown) => (v === null || v === undefined ? '' : `${num.format(Number(v))} MT`),
  kg: (v: unknown) => (v === null || v === undefined ? '' : `${num.format(Number(v))} kg`),
  date: (v: unknown) => (v ? dateF.format(new Date(String(v))) : ''),
  dateTime: (v: unknown) => (v ? dateTimeF.format(new Date(String(v))) : ''),
  bool: (v: unknown) => (v ? 'Yes' : 'No'),
  label: (v: unknown) => (v ? humanize(String(v)) : ''),
  text: (v: unknown) => (v === null || v === undefined ? '' : String(v)),
}
export type Formatter = keyof typeof fmt
