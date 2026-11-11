import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MousePointer2, Download, CornerDownRight, Printer } from 'lucide-react'
import { BRAND } from '../../saas/products'
import { cloud } from '../../saas/supabase'
import { getShareCloud } from '../../saas/cloud'
import { LOCAL_SHARE_PREFIX, decodeLocalShare, download, threadsCsv, type SharedList, type SharedThread } from '../../saas/stats'
import '../../saas/saas.css'

const STATUS = (t: SharedThread) => (t.resolved ? 'completed' : t.replies.length ? 'ongoing' : 'open')
const LABEL = { open: 'Open', ongoing: 'Ongoing', completed: 'Completed' } as const
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** A shared comment list: read-only, for anyone with the link. Grouped by page, oldest first. */
export default function SharePage() {
  const { token = '' } = useParams()
  const [list, setList] = useState<SharedList | null | undefined>(undefined)
  const [filter, setFilter] = useState<'all' | 'open' | 'ongoing' | 'completed'>('all')
  useEffect(() => {
    document.title = `Shared comments · ${BRAND}`
    if (token.startsWith(LOCAL_SHARE_PREFIX)) { setList(decodeLocalShare(token)); return }
    if (!cloud || !/^[0-9a-f]{64}$/.test(token)) { setList(null); return }
    void getShareCloud(token).then(setList)
  }, [token])
  const groups = useMemo(() => {
    const m = new Map<string, SharedThread[]>()
    for (const t of list?.threads ?? []) if (filter === 'all' || STATUS(t) === filter) m.set(t.page, [...(m.get(t.page) ?? []), t])
    return [...m.entries()]
  }, [list, filter])
  if (list === undefined) return <Frame><p className="lp-muted">Loading…</p></Frame>
  if (list === null) return <Frame><h1>This link isn’t available</h1><p className="lp-muted">It may have expired or been revoked. Ask the person who shared it for a new one.</p></Frame>
  const n = (s: typeof filter) => list.threads.filter((t) => s === 'all' || STATUS(t) === s).length
  return (
    <Frame>
      <div className="sp-head">
        <div>
          <span className="lp-eyebrow">Shared comments · read-only</span>
          <h1>{list.label || list.project}</h1>
          <p className="lp-muted">{list.label ? `${list.project} · ` : ''}{list.site ? <>{list.site.replace(/^https?:\/\//, '')} · </> : ''}{list.threads.length} comment{list.threads.length === 1 ? '' : 's'}{list.filter !== 'all' ? ` (${list.filter === 'open' ? 'not completed' : 'completed'} only)` : ''} · shared {when(list.created_at)}{list.expires_at ? ` · link works until ${when(list.expires_at)}` : ''}</p>
        </div>
        <span className="lp-row sp-actions">
          <button className="lp-btn sm" onClick={() => download(`${list.project.replace(/[^\w-]+/g, '-').toLowerCase()}-comments.csv`, threadsCsv(list.threads))}><Download size={14} /> CSV</button>
          <button className="lp-btn sm ghost" onClick={() => window.print()}><Printer size={14} /> Print</button>
        </span>
      </div>
      <div className="sp-tabs" role="group" aria-label="Status">
        {(['all', 'open', 'ongoing', 'completed'] as const).map((s) => <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : LABEL[s]} <span>{n(s)}</span></button>)}
      </div>
      {groups.length === 0 ? <p className="lp-muted">No comments here.</p> : groups.map(([page, rows]) => (
        <section key={page} className="sp-page">
          <h2><code>{page}</code> <span className="lp-muted">{rows.length}</span></h2>
          <ol className="sp-list">
            {rows.map((t, i) => (
              <li key={i} className="sp-item">
                <div className="sp-meta"><span className={`up-badge st-${STATUS(t)}`}>{LABEL[STATUS(t)]}</span><b>{t.author}</b><span className="lp-muted">{when(t.createdAt)}{t.editedAt ? ' · edited' : ''}</span></div>
                <p className="sp-text">{t.text}</p>
                {t.replies.map((r, j) => <p key={j} className="sp-reply"><CornerDownRight size={13} /> <b>{r.author}</b> {r.text} <span className="lp-muted">· {when(r.at)}</span></p>)}
                {t.resolved && <p className="sp-done">Completed by {t.resolved.by} · {when(t.resolved.at)}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp sp">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
      </header>
      <main className="lp-wrap sp-main">{children}</main>
    </div>
  )
}
