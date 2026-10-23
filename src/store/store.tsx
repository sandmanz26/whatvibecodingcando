import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MEMBERS, PROJECTS, TEAMS, buildInstalls, buildSkills } from '../data/seed'
import type { Member, Project, Skill, Team } from '../data/types'
import { findIssues, type Inventory, type Issue } from '../lib/logic'

/*
 * The inventory is read-only here: skills live in git, so changing one is a pull
 * request in its repository, not a button in this app. What this app keeps is
 * which findings someone looked at and decided to leave as they are.
 */

const KEY = 'skillhouse:v3'

function loadDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}').dismissed ?? [] } catch { return [] }
}

export interface Toast {
  id: string
  text: string
  tone: 'default' | 'error'
}

interface Ctx extends Inventory {
  /** who is looking — used to sign comments */
  me: Member
  issues: Issue[]
  /** issues nobody has set aside */
  open: Issue[]
  dismissed: string[]
  setDismissed: (id: string, on: boolean) => void
  member: (id: string) => Member | undefined
  team: (id: string) => Team | undefined
  project: (id: string) => Project | undefined
  skill: (id: string) => Skill | undefined
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
}

const StoreContext = createContext<Ctx | null>(null)
const uid = () => Math.random().toString(36).slice(2, 9)

export function StoreProvider({ children }: { children: ReactNode }) {
  const inv = useMemo<Inventory>(() => ({ skills: buildSkills(), installs: buildInstalls(), projects: PROJECTS, teams: TEAMS, members: MEMBERS }), [])
  const issues = useMemo(() => findIssues(inv), [inv])
  const [dismissed, setList] = useState<string[]>(loadDismissed)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ dismissed })) } catch { /* ignore */ }
  }, [dismissed])

  const setDismissed = useCallback((id: string, on: boolean) =>
    setList((l) => (on ? [...new Set([...l, id])] : l.filter((x) => x !== id))), [])

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((text: string, tone: Toast['tone'] = 'default') => {
    const id = uid()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => dismissToast(id), 4200)
  }, [dismissToast])

  const value = useMemo<Ctx>(() => ({
    ...inv,
    me: inv.members[0],
    issues,
    open: issues.filter((i) => !dismissed.includes(i.id)),
    dismissed,
    setDismissed,
    member: (id) => inv.members.find((m) => m.id === id),
    team: (id) => inv.teams.find((t) => t.id === id),
    project: (id) => inv.projects.find((p) => p.id === id),
    skill: (id) => inv.skills.find((s) => s.id === id),
    toasts,
    toast,
    dismissToast,
  }), [inv, issues, dismissed, setDismissed, toasts, toast, dismissToast])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const c = useContext(StoreContext)
  if (!c) throw new Error('useStore outside provider')
  return c
}
