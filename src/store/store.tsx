import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { MEMBERS, POLICIES, TEAMS, buildAudit, buildSkills, DEMO_NOW, slugify } from '../data/seed'
import type { AuditEvent, Member, Policy, Role, Skill, Stage, Team } from '../data/types'
import { blockers, bumpVersion, can, stageLabel } from '../lib/logic'

interface State {
  skills: Skill[]
  members: Member[]
  teams: Team[]
  policies: Policy[]
  audit: AuditEvent[]
  currentUserId: string
}

type Action =
  | { type: 'reset' }
  | { type: 'setUser'; id: string }
  | { type: 'upsertSkill'; skill: Skill; note: string; isNew: boolean }
  | { type: 'setStage'; id: string; stage: Stage }
  | { type: 'approve'; id: string }
  | { type: 'comment'; id: string; text: string }
  | { type: 'toggleAccess'; id: string; teamId: string }
  | { type: 'setRole'; memberId: string; role: Role }
  | { type: 'setOwner'; id: string; ownerId: string }
  | { type: 'togglePolicy'; id: string }
  | { type: 'attachEvals'; id: string }

const KEY = 'skillhouse:v1'

function initial(): State {
  return {
    skills: buildSkills(),
    members: MEMBERS,
    teams: TEAMS,
    policies: POLICIES,
    audit: buildAudit(),
    currentUserId: 'u1',
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* storage unavailable — fall back to seed */
  }
  return initial()
}

// The demo clock is frozen, so new events tick forward from DEMO_NOW to stay ordered.
let tick = 0
const now = () => new Date(DEMO_NOW.getTime() + ++tick * 60000).toISOString()
const uid = () => Math.random().toString(36).slice(2, 9)

function log(state: State, action: AuditEvent['action'], detail: string, skillId?: string): AuditEvent[] {
  return [{ id: uid(), at: now(), actorId: state.currentUserId, action, skillId, detail }, ...state.audit]
}

function patch(state: State, id: string, fn: (s: Skill) => Skill): Skill[] {
  return state.skills.map((s) => (s.id === id ? fn(s) : s))
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'reset':
      return { ...initial(), currentUserId: state.currentUserId }
    case 'setUser':
      return { ...state, currentUserId: a.id }
    case 'upsertSkill': {
      const skills = a.isNew ? [a.skill, ...state.skills] : state.skills.map((s) => (s.id === a.skill.id ? a.skill : s))
      return { ...state, skills, audit: log(state, a.isNew ? 'created' : 'updated', a.note, a.skill.id) }
    }
    case 'setStage': {
      const s = state.skills.find((x) => x.id === a.id)!
      const at = now()
      const published = a.stage === 'published'
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({
          ...s,
          stage: a.stage,
          updatedAt: at,
          // Sending back to draft clears approvals: reviewers re-check the new version.
          approvals: a.stage === 'draft' ? [] : s.approvals,
          versions: published && s.versions[0]?.version !== s.version
            ? [{ version: s.version, at, authorId: state.currentUserId, note: 'Published.' }, ...s.versions]
            : s.versions,
        })),
        audit: log(state, a.stage === 'review' ? 'submitted' : a.stage === 'published' ? 'published' : a.stage === 'deprecated' ? 'deprecated' : a.stage === 'draft' ? 'restored' : 'approved',
          `Moved “${s.title}” from ${stageLabel(s.stage)} to ${stageLabel(a.stage)}`, a.id),
      }
    }
    case 'approve': {
      const s = state.skills.find((x) => x.id === a.id)!
      if (s.approvals.includes(state.currentUserId)) return state
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({
          ...s,
          approvals: [...s.approvals, state.currentUserId],
          reviewerIds: s.reviewerIds.includes(state.currentUserId) ? s.reviewerIds : [...s.reviewerIds, state.currentUserId],
        })),
        audit: log(state, 'approved', `Approved v${s.version}`, a.id),
      }
    }
    case 'comment':
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({ ...s, comments: [...s.comments, { id: uid(), authorId: state.currentUserId, text: a.text, at: now() }] })),
        audit: log(state, 'commented', a.text.length > 70 ? a.text.slice(0, 70) + '…' : a.text, a.id),
      }
    case 'toggleAccess': {
      const s = state.skills.find((x) => x.id === a.id)!
      const has = s.teamIds.includes(a.teamId)
      const team = state.teams.find((t) => t.id === a.teamId)!
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({ ...s, teamIds: has ? s.teamIds.filter((t) => t !== a.teamId) : [...s.teamIds, a.teamId] })),
        audit: log(state, 'access', `${has ? 'Removed' : 'Shared with'} ${team.name}`, a.id),
      }
    }
    case 'setRole': {
      const m = state.members.find((x) => x.id === a.memberId)!
      return {
        ...state,
        members: state.members.map((x) => (x.id === a.memberId ? { ...x, role: a.role } : x)),
        audit: log(state, 'role', `Changed ${m.name} from ${m.role} to ${a.role}`),
      }
    }
    case 'setOwner': {
      const m = state.members.find((x) => x.id === a.ownerId)!
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({ ...s, ownerId: a.ownerId })),
        audit: log(state, 'updated', `Reassigned owner to ${m.name}`, a.id),
      }
    }
    case 'togglePolicy': {
      const p = state.policies.find((x) => x.id === a.id)!
      return {
        ...state,
        policies: state.policies.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)),
        audit: log(state, 'policy', `${p.enabled ? 'Disabled' : 'Enabled'} “${p.name}”`),
      }
    }
    case 'attachEvals':
      return {
        ...state,
        skills: patch(state, a.id, (s) => ({ ...s, hasEvals: true })),
        audit: log(state, 'updated', 'Attached eval suite (6 cases)', a.id),
      }
  }
}

/* ---------- toasts ---------- */

export interface Toast {
  id: string
  text: string
  tone: 'default' | 'error'
}

/* ---------- context ---------- */

interface Ctx extends State {
  me: Member
  dispatch: React.Dispatch<Action>
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismiss: (id: string) => void
  moveSkill: (id: string, to: Stage) => boolean
  saveSkill: (draft: Skill, isNew: boolean) => Skill
  member: (id: string) => Member | undefined
  team: (id: string) => Team | undefined
  skill: (id: string) => Skill | undefined
  lens: boolean
  setLens: (v: boolean) => void
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lens, setLensState] = useState<boolean>(() => {
    try { return localStorage.getItem('skillhouse:lens') !== 'off' } catch { return true }
  })
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const setLens = useCallback((v: boolean) => {
    setLensState(v)
    try { localStorage.setItem('skillhouse:lens', v ? 'on' : 'off') } catch { /* ignore */ }
  }, [])

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((text: string, tone: Toast['tone'] = 'default') => {
    const id = uid()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => dismiss(id), 4200)
  }, [dismiss])

  const moveSkill = useCallback((id: string, to: Stage) => {
    const st = stateRef.current
    const s = st.skills.find((x) => x.id === id)!
    const me = st.members.find((m) => m.id === st.currentUserId)
    const why = blockers(s, to, me, st.policies)
    if (why.length) {
      toast(`Can’t move to ${stageLabel(to)}: ${why[0]}`, 'error')
      return false
    }
    dispatch({ type: 'setStage', id, stage: to })
    toast(`“${s.title}” moved to ${stageLabel(to)}`)
    return true
  }, [toast])

  const saveSkill = useCallback((draft: Skill, isNew: boolean) => {
    const st = stateRef.current
    const prev = st.skills.find((s) => s.id === draft.id)
    const at = now()
    const skill: Skill = isNew
      ? { ...draft, id: 's' + uid(), name: slugify(draft.title), createdAt: at, updatedAt: at, ownerId: st.currentUserId,
          versions: [{ version: draft.version, at, authorId: st.currentUserId, note: 'First draft.' }] }
      : { ...draft, name: slugify(draft.title), updatedAt: at }
    if (!isNew && prev && prev.stage === 'published') {
      // Editing a live skill creates a new version that goes back through review.
      skill.version = bumpVersion(prev.version)
      skill.stage = 'review'
      skill.approvals = []
      skill.versions = [{ version: skill.version, at, authorId: st.currentUserId, note: 'Edited — pending review.' }, ...prev.versions]
    }
    dispatch({ type: 'upsertSkill', skill, isNew, note: isNew ? 'Created draft' : prev?.stage === 'published' ? `Edited, bumped to v${skill.version} and sent to review` : 'Edited skill' })
    return skill
  }, [])

  const value = useMemo<Ctx>(() => {
    const me = state.members.find((m) => m.id === state.currentUserId) ?? state.members[0]
    return {
      ...state,
      me,
      dispatch,
      toasts,
      toast,
      dismiss,
      moveSkill,
      saveSkill,
      member: (id) => state.members.find((m) => m.id === id),
      team: (id) => state.teams.find((t) => t.id === id),
      skill: (id) => state.skills.find((s) => s.id === id),
      lens,
      setLens,
    }
  }, [state, toasts, toast, dismiss, moveSkill, saveSkill, lens, setLens])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const c = useContext(StoreContext)
  if (!c) throw new Error('useStore outside provider')
  return c
}

export function useCan() {
  const { me } = useStore()
  return (p: Parameters<typeof can>[1], s?: Skill) => can(me, p, s)
}
