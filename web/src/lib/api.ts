export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    let msg = res.statusText
    try { const j = await res.json(); msg = typeof j.detail === 'string' ? j.detail : msg } catch { /* not json */ }
    if (res.status === 401 && !location.pathname.startsWith('/login')) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

export type Page<T> = { rows: T[]; total: number; page: number; size: number }

export type Me = {
  id: number; full_name: string; email: string | null; employee_code: string | null
  roles: string[]; permissions: string[]
}

export const can = (me: Me | undefined, module: string, action = 'view') =>
  !!me && (me.permissions.includes(`${module}:${action}`) || me.permissions.includes('admin:admin'))
