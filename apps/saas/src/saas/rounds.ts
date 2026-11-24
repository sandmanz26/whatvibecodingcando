/**
 * Review rounds for the panel, in both modes: on the server (review_rounds / round_approvals, under
 * the members' row level security, see supabase/migrations/…_review_rounds.sql) or, in the
 * browser-only demo, in this browser (the same file the widget on the demo site reads).
 */
import { useCallback, useEffect, useState } from 'react'
import { cloud } from './supabase'
import { listRoundsCloud, startRoundCloud, updateRoundCloud } from './cloud'
import { readLocalRounds, roundsKey, uid, writeLocalRounds, type RoundInfo } from '../core/embed/store'
import type { Project } from './account'

export interface Approval {
  id: string
  roundId: string
  name: string
  version: string | null
  statement: string
  origin: string
  openComments: number
  openList: { page: string; author: string; text: string; at: string }[]
  at: string
}
export type { RoundInfo }

export const roundsOf = (p: Project | null | undefined) => p?.rounds ?? { on: false, included: 2 }

/** The demo widget reads the project's round settings from this browser: kept in step with the panel. */
export function serveRounds(p: Project) {
  if (cloud) return
  const r = readLocalRounds(p.id)
  const want = roundsOf(p)
  if (r.on === want.on && r.included === want.included) return
  try { writeLocalRounds(p.id, { ...r, on: want.on, included: want.included }) } catch { /* storage full: the widget keeps the old settings */ }
}

export async function listRounds(projectId: string): Promise<{ rounds: RoundInfo[]; approvals: Approval[] }> {
  if (cloud) return listRoundsCloud(projectId)
  const r = readLocalRounds(projectId)
  return { rounds: [...r.rounds].sort((a, b) => b.n - a.n), approvals: [...r.approvals].sort((a, b) => b.at.localeCompare(a.at)) }
}

const ping = (projectId: string) => window.dispatchEvent(new StorageEvent('storage', { key: roundsKey(projectId) }))

export async function startRound(projectId: string, x: { n: number; name: string; note: string; due: string | null }) {
  const clean = { n: x.n, name: x.name.trim().slice(0, 80) || `Round ${x.n}`, note: x.note.trim().slice(0, 2000), due: x.due || null }
  if (cloud) return startRoundCloud(projectId, clean)
  const r = readLocalRounds(projectId)
  if (r.rounds.some((y) => y.status === 'open')) throw new Error('Another round is already open. Close it first.')
  r.rounds.push({ id: uid(), ...clean, status: 'open', startedAt: new Date().toISOString(), closedAt: null })
  writeLocalRounds(projectId, r)
  ping(projectId)
}

export async function updateRound(projectId: string, id: string, patch: { name?: string; note?: string; due?: string | null; status?: 'open' | 'closed' }) {
  const p = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) } : {}), ...(patch.note !== undefined ? { note: patch.note.trim().slice(0, 2000) } : {}) }
  if (cloud) return updateRoundCloud(id, p)
  const r = readLocalRounds(projectId)
  const x = r.rounds.find((y) => y.id === id)
  if (!x) throw new Error('That round is gone.')
  if (p.status === 'open' && r.rounds.some((y) => y.status === 'open' && y.id !== id)) throw new Error('Another round is already open. Close it first.')
  Object.assign(x, p)
  if (p.status === 'closed') x.closedAt = new Date().toISOString()
  if (p.status === 'open') x.closedAt = null
  writeLocalRounds(projectId, r)
  ping(projectId)
}

/** The project's rounds and approvals, reloaded every 30 s while the tab is visible (approvals arrive from the site). */
export function useRounds(projectId: string | undefined) {
  const [data, setData] = useState<{ rounds: RoundInfo[]; approvals: Approval[] } | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!projectId) return
    void listRounds(projectId).then((d) => { setData(d); setError('') }, (e) => setError((e as Error).message ?? 'Couldn’t load the rounds.'))
  }, [projectId])
  useEffect(() => {
    setData(null)
    load()
    const iv = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, cloud ? 30_000 : 4000)
    return () => window.clearInterval(iv)
  }, [load])
  return { rounds: data?.rounds ?? [], approvals: data?.approvals ?? [], loaded: !!data, error, reload: load }
}

/** "Round 2 of 2", "Round 3 · Extra round", or "Round 4" when the quote has no limit. */
export function roundLabel(n: number, included: number | null) {
  if (included == null) return `Round ${n}`
  return n > included ? `Round ${n} · Extra round` : `Round ${n} of ${included}`
}
