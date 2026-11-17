import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { ProfileLine } from '../components/Profile'

export default function Login() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const me = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })
      qc.setQueryData(['me'], me)
      navigate(params.get('next') || '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'That email or employee code and password do not match.' : 'Could not reach the server. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img src="/crayon-logo-light.png" alt="" className="h-10 w-auto self-start" />
        <div className="relative">
          <ProfileLine width={640} layers={6} className="w-[118%] -ml-[4%] text-steel-400" />
          <h1 className="mt-14 max-w-md text-[2rem] font-semibold leading-tight text-white">
            Every coil, order and dispatch at Crayon, in one place.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-steel-200">
            Indents to purchase, stock to production, orders to invoice, with Tally kept in step automatically.
          </p>
        </div>
        <p className="text-xs text-steel-200/70">Crayon Roofings &amp; Structures, Manali, Chennai</p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <img src="/crayon-logo.png" alt="Crayon Roofings & Structures" className="mb-10 h-10 w-auto dark:hidden lg:hidden" />
          <h2 className="text-xl font-semibold">Sign in to Crayon ERP</h2>
          <p className="mt-1 text-sm text-ink-soft dark:text-slate-400">Opening the ERP from the group app hub signs you in automatically.</p>
          <label className="mt-8 block text-sm font-medium" htmlFor="login">Email or employee code</label>
          <input id="login" className="field mt-1.5" autoComplete="username" autoFocus value={login} onChange={e => setLogin(e.target.value)} required />
          <label className="mt-4 block text-sm font-medium" htmlFor="password">Password</label>
          <input id="password" type="password" className="field mt-1.5" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p role="alert" className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-sm text-bad">{error}</p>}
          <button className="btn-primary mt-6 w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="mt-16 flex flex-col items-center gap-2 text-xs text-ink-faint">
          A Bharat Steel Group company
          <img src="/bsg-wordmark.png" alt="The Bharat Steel Group" className="h-9 w-auto opacity-90 dark:hidden" />
        </div>
      </section>
    </div>
  )
}
