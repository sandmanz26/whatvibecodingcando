import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, Library, FolderGit2, Users, HeartPulse, CornerDownLeft } from 'lucide-react'
import { useStore } from '../store/store'
import { statusIcon } from './ui'

interface Item {
  id: string
  group: string
  label: string
  sub?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette({ onClose, v2 = false }: { onClose: () => void; v2?: boolean }) {
  const { skills, projects, teams } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => { nav(path); onClose() }
    const base = v2 ? '/v2' : ''
    const pages: Item[] = v2 ? [
      { id: 'p-home', group: 'Pages', label: 'Home', icon: <LayoutGrid size={15} />, run: go('/v2') },
      { id: 'p-shelf', group: 'Pages', label: 'Shelves', icon: <Library size={15} />, run: go('/v2/shelf') },
      { id: 'p-projects', group: 'Pages', label: 'Projects', icon: <FolderGit2 size={15} />, run: go('/v2/projects') },
      { id: 'p-tidy', group: 'Pages', label: 'Tidy up', icon: <HeartPulse size={15} />, run: go('/v2/tidy') },
    ] : [
      { id: 'p-o', group: 'Pages', label: 'Overview', icon: <LayoutGrid size={15} />, run: go('/') },
      { id: 'p-s', group: 'Pages', label: 'Skills', icon: <Library size={15} />, run: go('/skills') },
      { id: 'p-p', group: 'Pages', label: 'Projects', icon: <FolderGit2 size={15} />, run: go('/projects') },
      { id: 'p-t', group: 'Pages', label: 'Teams', icon: <Users size={15} />, run: go('/teams') },
      { id: 'p-h', group: 'Pages', label: 'Health', icon: <HeartPulse size={15} />, run: go('/health') },
    ]
    const all: Item[] = [
      ...pages,
      ...skills.map((s) => ({ id: s.id, group: 'Skills', label: s.title, sub: s.name, icon: statusIcon(s.status), run: go(`${base}/skills/${s.id}`) })),
      ...projects.map((p) => ({ id: p.id, group: 'Projects', label: p.name, sub: p.description, icon: <FolderGit2 size={15} />, run: go(`${base}/projects/${p.id}`) })),
      ...(v2 ? [] : teams.map((t) => ({ id: t.id, group: 'Teams', label: t.name, icon: <Users size={15} />, run: go(`/teams?team=${t.id}`) }))),
    ]
    const t = q.trim().toLowerCase()
    if (!t) return all.slice(0, 14)
    const words = t.split(/\s+/)
    return all.filter((i) => { const hay = `${i.label} ${i.sub ?? ''} ${i.group}`.toLowerCase(); return words.every((w) => hay.includes(w)) }).slice(0, 30)
  }, [q, skills, projects, teams, nav, onClose, v2])

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
          <input autoFocus placeholder="Search skills, projects, teams…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" role="combobox" aria-expanded aria-controls="palette-list" />
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
        </div>
      </div>
    </>
  )
}
