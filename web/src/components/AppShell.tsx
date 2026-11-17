import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { CommandBar } from './CommandBar'
import { useMe } from '../lib/me'
import { api } from '../lib/api'
import { isDark, toggleTheme } from '../lib/theme'

export function AppShell() {
  const { data: me } = useMe()
  const [cmd, setCmd] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [dark, setDark] = useState(isDark())
  const navigate = useNavigate()
  const qc = useQueryClient()
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => setDrawer(false), [loc.pathname])

  const signOut = async () => { await api('/auth/logout', { method: 'POST' }); qc.clear(); navigate('/login') }
  const initials = (me?.full_name ?? '').split(' ').map(s => s[0]).slice(0, 2).join('')

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block"><Sidebar me={me} /></div>
      {drawer && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-navy-900/40" onClick={() => setDrawer(false)} />
          <div className="relative h-full w-64 shadow-pop"><Sidebar me={me} onNavigate={() => setDrawer(false)} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4 dark:border-white/10 dark:bg-[#132033]">
          <button className="btn-quiet px-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>{drawer ? <X size={18} /> : <Menu size={18} />}</button>
          <button onClick={() => setCmd(true)}
            className="flex h-9 min-w-0 flex-1 max-w-md items-center gap-2 rounded-md border border-line bg-canvas px-3 text-sm text-ink-faint hover:border-steel-200 dark:border-white/10 dark:bg-white/5">
            <Search size={15} /> <span className="truncate">Search or jump to</span>
            <kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 text-2xs text-ink-faint sm:inline dark:border-white/10 dark:bg-transparent">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-quiet px-2" aria-label={dark ? 'Use light theme' : 'Use dark theme'} onClick={() => setDark(toggleTheme())}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="btn-quiet hidden px-2 sm:inline-flex" aria-label="Notifications"><Bell size={17} /></button>
            <div className="ml-1 flex items-center gap-2 border-l border-line pl-2 sm:ml-2 sm:pl-3 dark:border-white/10">
              <span className="hidden h-8 w-8 place-items-center rounded-full sm:grid bg-steel-100 text-xs font-semibold text-steel-700">{initials}</span>
              <div className="hidden leading-tight md:block">
                <div className="text-sm font-medium">{me?.full_name}</div>
                <div className="text-2xs text-ink-faint">{me?.roles.join(', ')}</div>
              </div>
              <button className="btn-quiet px-2" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
      <CommandBar open={cmd} setOpen={setCmd} me={me} />
    </div>
  )
}
