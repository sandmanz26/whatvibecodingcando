import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Download } from 'lucide-react'
import { Modal } from './ui'
import { useStore } from '../store/store'
import { slugify } from '../data/seed'
import type { Category, Skill } from '../data/types'

interface CatalogEntry { title: string; repo: string; path: string; origin: string; license: string; version: string; category: Category; description: string }

/** Known sources. There is no backend here, so nothing is fetched: importing records the source and pins it. */
const CATALOG: CatalogEntry[] = [
  { title: 'Spreadsheets', repo: 'anthropics/skills', path: 'skills/xlsx', origin: 'Anthropic', license: 'See repository', version: '1.0.0', category: 'Operations', description: 'Creates, cleans and analyses spreadsheets (.xlsx, .csv), with formulas and charts. Use when a spreadsheet is the input or the output.' },
  { title: 'Slide decks', repo: 'anthropics/skills', path: 'skills/pptx', origin: 'Anthropic', license: 'See repository', version: '1.0.0', category: 'Writing', description: 'Builds and edits PowerPoint decks from notes or outlines. Use when someone asks for slides or a .pptx.' },
  { title: 'Skill creator', repo: 'anthropics/skills', path: 'skills/skill-creator', origin: 'Anthropic', license: 'See repository', version: '1.0.0', category: 'Engineering', description: 'Helps write and test new skills, including evals for them. Use when someone wants to make a skill of their own.' },
  { title: 'Design taste', repo: 'Leonxlnx/taste-skill', path: 'skills/taste-skill', origin: 'Leonxlnx (community)', license: 'MIT', version: '2.0.0', category: 'Design', description: 'Art direction for web pages and app screens with a real-browser checker. Use when a page looks generic.' },
]

function parseGitHub(url: string) {
  const m = url.trim().match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/[^/]+\/(.+?))?\/?$/)
  if (!m) return null
  const [, owner, repo, path = ''] = m
  const leaf = (path.split('/').filter(Boolean).pop() ?? repo).replace(/[-_]/g, ' ')
  return { repo: `${owner}/${repo}`, path, title: leaf[0].toUpperCase() + leaf.slice(1), url: `https://github.com/${owner}/${repo}` }
}

export function ImportExternal({ onClose, base = '' }: { onClose: () => void; base?: '' | '/v2' }) {
  const { skills, me, dispatch, toast } = useStore()
  const nav = useNavigate()
  const [url, setUrl] = useState('')
  const parsed = url ? parseGitHub(url) : null
  const have = (repo: string, path: string) => skills.some((s) => s.source?.repo === repo && s.source.path === path)

  const add = (e: { title: string; repo: string; path: string; origin: string; license: string; version: string; category: Category; description: string; url: string }) => {
    const at = new Date().toISOString()
    const id = 'x' + Math.random().toString(36).slice(2, 8)
    const skill: Skill = {
      id, name: slugify(e.title), title: e.title, description: e.description, category: e.category, ownerId: me.id, teamIds: [me.teamId],
      stage: 'review', version: e.version, createdAt: at, updatedAt: at, triggers: [],
      instructions: `Imported from ${e.repo}${e.path ? `/${e.path}` : ''}. Instructions are maintained upstream; changes arrive as new versions and go through review here.`,
      examples: [], tools: ['Read'], usage: Array(12).fill(0), usageByTeam: {}, rating: 0, minutesSaved: 15,
      reviewerIds: [], approvals: [], comments: [], hasEvals: false,
      versions: [{ version: e.version, at, authorId: me.id, note: `Imported from ${e.repo}.` }],
      source: { kind: 'external', origin: e.origin, repo: e.repo, path: e.path, url: e.url, license: e.license, pinned: e.version, syncedAt: at, vetted: false },
    }
    dispatch({ type: 'importExternal', skill })
    toast(`${e.title} imported — it waits for a security review before anyone can use it`)
    onClose()
    nav(`${base}/skills/${id}`)
  }

  return (
    <Modal title="Bring in a skill from outside" description="Imported skills are pinned to the version you bring in and wait for a security review. Nothing reaches the team until it passes." onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="stack gap-12">
        <div className="field">
          <label htmlFor="gh">From a GitHub link</label>
          <div className="row">
            <input id="gh" className="input" placeholder="https://github.com/owner/repo/tree/main/skills/name" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn primary" disabled={!parsed} onClick={() => parsed && add({ ...parsed, origin: parsed.repo.split('/')[0], license: 'Check before approving', version: '1.0.0', category: 'Operations', description: `Imported from ${parsed.repo}. Write what it does and when to use it before it is reviewed.` })}>
              <Download size={14} /> Import
            </button>
          </div>
          {url && !parsed && <span className="hint" style={{ color: 'var(--critical-ink)' }}>That doesn’t look like a GitHub repository link.</span>}
        </div>
        <div className="label" style={{ marginTop: 6 }}>Or pick a known source</div>
        <div className="stack gap-4">
          {CATALOG.map((c) => {
            const done = have(c.repo, c.path)
            return (
              <div key={c.repo + c.path} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 550 }}>{c.title}</div>
                  <div className="muted row" style={{ fontSize: 12.5, gap: 4 }}><GitBranch size={12} /> {c.repo}/{c.path} · {c.license}</div>
                </div>
                <button className="btn sm" disabled={done} onClick={() => add({ ...c, url: `https://github.com/${c.repo}` })}>{done ? 'Already here' : 'Import'}</button>
              </div>
            )
          })}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>This demo has no backend, so it records the source and pins the version without downloading files.</p>
      </div>
    </Modal>
  )
}
