import { Command } from 'cmdk'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { LISTS, NAV } from '../nav'
import type { Me } from '../lib/api'
import { can } from '../lib/api'

export function CommandBar({ open, setOpen, me }: { open: boolean; setOpen: (v: boolean) => void; me?: Me }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  useEffect(() => { if (!open) setValue('') }, [open])

  const go = (path: string) => { setOpen(false); navigate(path) }
  const pages = NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.label })))
    .filter(i => !('module' in i) || !i.module || can(me, i.module))
  const searchable = LISTS.filter(l => can(me, l.module))

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Search or jump to"
      overlayClassName="fixed inset-0 z-40 bg-navy-900/30 backdrop-blur-[1px]"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-pop dark:bg-[#132033]">
      <div className="flex items-center gap-2 border-b border-line px-4 dark:border-white/10">
        <Search size={16} className="text-ink-faint" />
        <Command.Input value={value} onValueChange={setValue} placeholder="Search pages, or type a document or coil number"
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint" />
      </div>
      <Command.List className="max-h-[52vh] overflow-y-auto p-2 text-sm">
        <Command.Empty className="px-3 py-6 text-center text-ink-faint">No page matches “{value}”.</Command.Empty>
        {value.trim().length >= 2 && (
          <Command.Group heading="Find in" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-faint">
            {searchable.slice(0, 6).map(l => (
              <Item key={`find-${l.id}`} value={`find ${value} ${l.label}`} onSelect={() => go(`${l.path}?q=${encodeURIComponent(value.trim())}`)}>
                <l.icon size={16} className="text-steel" /> <span>“{value.trim()}” in {l.label}</span>
              </Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-faint">
          {pages.map(p => (
            <Item key={p.id} value={`${p.label} ${p.group} ${p.keywords ?? ''}`} onSelect={() => go(p.path)}>
              <p.icon size={16} className="text-steel" /> <span>{p.label}</span>
              <span className="ml-auto text-xs text-ink-faint">{p.group}</span>
            </Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-xs text-ink-faint dark:border-white/10">
        <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> open</span>
        <span>↑↓ move</span><span>Esc close</span>
      </div>
    </Command.Dialog>
  )
}

function Item({ children, ...props }: React.ComponentProps<typeof Command.Item>) {
  return (
    <Command.Item {...props}
      className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-ink aria-selected:bg-steel-50 dark:text-slate-200 dark:aria-selected:bg-white/5">
      {children}
    </Command.Item>
  )
}
