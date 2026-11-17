import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { NAV } from '../nav'
import type { Me } from '../lib/api'
import { can } from '../lib/api'
import { ProfileLine } from './Profile'

export function Sidebar({ me, onNavigate }: { me?: Me; onNavigate?: () => void }) {
  return (
    <nav aria-label="Modules" className="flex h-full w-64 flex-col bg-navy text-slate-200">
      <div className="px-5 pt-5">
        <img src="/crayon-logo-light.png" alt="Crayon Roofings & Structures" className="h-9 w-auto" />
        <ProfileLine width={420} className="mt-4 h-4 w-full text-steel-400/60" />
      </div>
      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]">
        {NAV.map(g => {
          const items = g.items.filter(i => !('module' in i) || !i.module || can(me, i.module))
          if (!items.length) return null
          return (
            <div key={g.label} className="mt-4 first:mt-2">
              <div className="px-2 pb-1 text-2xs font-medium text-steel-200/70">{g.label}</div>
              {items.map(i => {
                const Icon = i.icon
                return (
                  <NavLink key={i.id} to={i.path} end={i.path === '/'} onClick={onNavigate}
                    className={({ isActive }) => clsx(
                      'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
                      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
                    {({ isActive }) => (<>
                      {isActive && <span className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r bg-amber" />}
                      <Icon size={16} strokeWidth={1.75} className={isActive ? 'text-white' : 'text-steel-200/80'} />
                      {i.label}
                    </>)}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/10 px-5 py-3 text-2xs text-steel-200/70">A Bharat Steel Group company</div>
    </nav>
  )
}
