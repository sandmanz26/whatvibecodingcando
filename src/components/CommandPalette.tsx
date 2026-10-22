import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, LayoutGrid, Library, KanbanSquare, Users, ShieldCheck, LineChart, Sparkles, Moon, Lightbulb, UserRound, CornerDownLeft } from 'lucide-react'
import { useStore } from '../store/store'
import { stageIcon } from './ui'

interface Item {
  id: string
  group: string
  label: string
  sub?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette({ onClose, toggleTheme }: { onClose: () => void; toggleTheme: () => void }) {
  const { skills, members, dispatch, lens, setLens, toast } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => { nav(path); onClose() }
    const all: Item[] = [
      { id: 'new', group: 'Actions', label: 'Create new skill', icon: <Plus size={15} />, run: go('/skills/new') },
      { id: 'theme', group: 'Actions', label: 'Toggle dark mode', icon: <Moon size={15} />, run: () => { toggleTheme(); onClose() } },
      { id: 'lens', group: 'Actions', label: lens ? 'Hide demo lens' : 'Show demo lens', icon: <Lightbulb size={15} />, run: () => { setLens(!lens); onClose() } },
      { id: 'p-o', group: 'Pages', label: 'Overview', icon: <LayoutGrid size={15} />, run: go('/') },
      { id: 'p-l', group: 'Pages', label: 'Skill library', icon: <Library size={15} />, run: go('/skills') },
      { id: 'p-p', group: 'Pages', label: 'Review pipeline', icon: <KanbanSquare size={15} />, run: go('/pipeline') },
      { id: 'p-t', group: 'Pages', label: 'Team & access', icon: <Users size={15} />, run: go('/team') },
      { id: 'p-g', group: 'Pages', label: 'Governance', icon: <ShieldCheck size={15} />, run: go('/governance') },
      { id: 'p-i', group: 'Pages', label: 'Insights', icon: <LineChart size={15} />, run: go('/insights') },
      { id: 'p-b', group: 'Pages', label: 'Playbook', icon: <Sparkles size={15} />, run: go('/playbook') },
      ...skills.map((s) => ({ id: s.id, group: 'Skills', label: s.title, sub: s.name, icon: stageIcon(s.stage), run: go(`/skills/${s.id}`) })),
      ...members.map((m) => ({
        id: m.id, group: 'View as', label: m.name, sub: m.role, icon: <UserRound size={15} />,
        run: () => { dispatch({ type: 'setUser', id: m.id }); toast(`Now viewing as ${m.name} (${m.role})`); onClose() },
      })),
    ]
    const t = q.trim().toLowerCase()
    if (!t) return all.filter((i) => i.group !== 'View as').slice(0, 14)
    return all.filter((i) => `${i.label} ${i.sub ?? ''} ${i.group}`.toLowerCase().includes(t)).slice(0, 30)
  }, [q, skills, members, nav, onClose, toggleTheme, lens, setLens, dispatch, toast])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
    if (e.key === 'Enter') items[sel]?.run()
  }

  let lastGroup = ''
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
        <div className="palette-input">
          <Search size={16} color="var(--ink-3)" />
          <input autoFocus placeholder="Search skills, pages, people…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" role="combobox" aria-expanded aria-controls="palette-list" />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} id="palette-list" role="listbox">
          {items.length === 0 && <div className="empty" style={{ padding: 28 }}>No matches for “{q}”</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <div className="palette-group">{it.group}</div> : null
            lastGroup = it.group
            return (
              <div key={it.group + it.id}>
                {head}
                <div className="palette-item" role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={it.run}>
                  {it.icon}
                  <span>{it.label}</span>
                  {it.sub && <span className="sub mono">{it.sub}</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd><CornerDownLeft size={10} /></kbd> open</span>
          <span>Try “view as” to switch roles</span>
        </div>
      </div>
    </>
  )
}
