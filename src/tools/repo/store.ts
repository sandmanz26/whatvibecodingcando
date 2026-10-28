/**
 * Insight repository — research findings kept, tagged and searchable, each pointing back
 * to the screen (and element) it is about. Frontend only: this browser's localStorage.
 */
import { APP, readJSON, writeJSON } from '../shared'

export type InsightSource = 'sessions' | 'usability' | 'fivesec' | 'doors' | 'gaze' | 'notes' | 'comments' | 'design-check' | 'manual'
export type InsightStatus = 'new' | 'acting' | 'done' | 'wontfix'
export type Impact = 'high' | 'medium' | 'low'

export interface Insight {
  id: string
  title: string
  detail: string
  /** what backs it up, in plain words: "7 of 12 sessions", "3 rage taps" */
  evidence: string
  source: InsightSource
  impact: Impact
  status: InsightStatus
  tags: string[]
  /** where it happens; sel rings the element on the screen */
  page?: string
  query?: string
  sel?: string
  createdAt: string
  updatedAt: string
}

export const SOURCE_LABEL: Record<InsightSource, string> = {
  sessions: 'Sessions', usability: 'Usability test', fivesec: '5-second test', doors: 'Fake door', gaze: 'Eye tracking',
  notes: 'Researcher notes', comments: 'Comments', 'design-check': 'Design system check', manual: 'Added by hand',
}
export const STATUS_LABEL: Record<InsightStatus, string> = { new: 'New', acting: 'Being worked on', done: 'Done', wontfix: 'Won’t act' }
export const SUGGESTED_TAGS = ['Navigation', 'Search', 'AI', 'Trust', 'Checkout', 'Copy', 'Visual', 'Accessibility', 'Opportunity', 'Bug']

const KEY = `${APP}.repo`
export const REPO_EVENT = `${APP}:repo`
export const uid = () => Math.random().toString(36).slice(2, 10)

export const loadInsights = () => readJSON<Insight[]>(KEY, [])
export function saveInsights(list: Insight[]) {
  writeJSON(KEY, list)
  window.dispatchEvent(new Event(REPO_EVENT))
}

/** Adds a finding unless one with the same title and page is already kept. Returns whether it was added. */
export function keep(i: Omit<Insight, 'id' | 'status' | 'createdAt' | 'updatedAt'>): boolean {
  const list = loadInsights()
  if (list.some((x) => x.title === i.title && x.page === i.page)) return false
  const now = new Date().toISOString()
  saveInsights([{ ...i, id: uid(), status: 'new', createdAt: now, updatedAt: now }, ...list])
  return true
}

export const isKept = (title: string, page?: string) => loadInsights().some((x) => x.title === title && x.page === page)

export function toMarkdown(list: Insight[]) {
  const lines = ['# Insights', '']
  for (const i of list) {
    lines.push(`## ${i.title}`, '', `- Impact: ${i.impact} · Status: ${STATUS_LABEL[i.status]} · Source: ${SOURCE_LABEL[i.source]}`)
    if (i.page) lines.push(`- Where: ${i.page}${i.query ? `?${i.query}` : ''}`)
    if (i.tags.length) lines.push(`- Tags: ${i.tags.join(', ')}`)
    lines.push(`- Evidence: ${i.evidence}`, '', i.detail, '')
  }
  return lines.join('\n')
}
