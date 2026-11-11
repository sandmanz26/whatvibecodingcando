import { useEffect, useState } from 'react'
import { Copy, Link2, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal } from '../../components/ui'
import type { Thread } from '../../core/embed/store'
import { copyText } from '../../saas/snippet'
import { cloud } from '../../saas/supabase'
import { createShareCloud, listSharesCloud, revokeShareCloud } from '../../saas/cloud'
import { encodeLocalShare, keepFor, toShared, type ShareRow, type SharedList } from '../../saas/stats'
import { ago } from './Panel'

/** The address of a share page for a token. */
export const shareUrl = (token: string) => `${window.location.origin}${window.location.pathname}#/share/${token}`

const FILTERS = { all: 'All comments', open: 'Not completed', completed: 'Completed' } as const
const EXPIRY: { v: number | null; label: string }[] = [{ v: 7, label: '7 days' }, { v: 30, label: '30 days' }, { v: 90, label: '90 days' }, { v: null, label: 'No expiry' }]

/**
 * Share the comment list as a link: a read-only page anyone with the link can open (no account),
 * for a teammate or a client. On the server, links are kept, counted, expire and can be revoked;
 * in the demo the list travels inside the link itself.
 */
export function ShareList({ project, threads, onClose }: { project: { id: string; name: string; siteUrl: string }; threads: Thread[]; onClose: () => void }) {
  const { toast } = useStore()
  const [label, setLabel] = useState('')
  const [filter, setFilter] = useState<SharedList['filter']>('all')
  const [days, setDays] = useState<number | null>(30)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ShareRow[]>([])
  const load = () => { if (cloud) void listSharesCloud(project.id).then(setRows).catch(() => { /* retried on reopen */ }) }
  useEffect(load, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const count = threads.filter(keepFor(filter)).length
  const make = async () => {
    setBusy(true)
    try {
      if (cloud) {
        setLink(shareUrl(await createShareCloud(project.id, { label: label.trim(), status: filter, days })))
        load()
      } else {
        const token = encodeLocalShare({ project: project.name, site: project.siteUrl, label: label.trim() || null, filter, created_at: new Date().toISOString(), expires_at: null, threads: threads.filter(keepFor(filter)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toShared) })
        if (!token) { toast('Too many comments to put in a link without the server.', 'error'); return }
        setLink(shareUrl(token))
      }
    } catch (e) { toast(`Couldn’t make the link: ${(e as Error).message}`, 'error') } finally { setBusy(false) }
  }
  const copy = () => void copyText(link).then((ok) => toast(ok ? 'Link copied' : 'Copy failed. Select and copy it by hand.', ok ? undefined : 'error'))
  return (
    <Modal title="Share the comment list" description={`A read-only page with “${project.name}”’s comments. Anyone with the link can open it, without an account.`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn primary" disabled={busy || count === 0} onClick={() => void make()}><Link2 size={14} /> {busy ? 'Making…' : 'Make link'}</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="sh-label">Name (optional, shown on the page)</label><input id="sh-label" className="input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Review round 2 for the design team" /></div>
        <div className="field"><label>Which comments</label>
          <div className="seg" role="group" aria-label="Which comments">{(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{FILTERS[f]}</button>)}</div>
          <span className="hint">{count} comment{count === 1 ? '' : 's'} now{cloud ? '; the page always shows the current list' : '; the link holds the list as it is now'}.</span>
        </div>
        {cloud && <div className="field"><label>Link works for</label>
          <div className="seg" role="group" aria-label="Link works for">{EXPIRY.map((x) => <button key={x.label} aria-pressed={days === x.v} onClick={() => setDays(x.v)}>{x.label}</button>)}</div></div>}
        {link && <div className="up-linkbox"><pre className="up-code">{link}</pre><span className="up-row"><button className="lp-btn sm" onClick={copy}><Copy size={13} /> Copy link</button><a className="lp-btn sm ghost" href={link} target="_blank" rel="noopener">Open</a></span></div>}
        <p className="hint">The page shows comments, replies, the names reviewers gave and the page they were on. {cloud ? 'Revoke the link below whenever you want it to stop working.' : 'Demo mode: there is no server to revoke it; the link holds a copy.'}</p>
        {cloud && rows.length > 0 && (
          <div className="field"><label>Links made</label>
            <ul className="sh-rows">{rows.map((r) => {
              const dead = !!r.revoked_at || (!!r.expires_at && new Date(r.expires_at) < new Date())
              return (
                <li key={r.id} className={dead ? 'dead' : ''}>
                  <span className="lp-grow"><b>{r.label || FILTERS[r.status_filter]}</b><small>{FILTERS[r.status_filter]} · made {ago(r.created_at)} · {r.views} view{r.views === 1 ? '' : 's'} · {r.revoked_at ? 'revoked' : r.expires_at ? (dead ? 'expired' : `until ${new Date(r.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`) : 'no expiry'}</small></span>
                  {!dead && <button className="lp-btn sm ghost" onClick={() => void revokeShareCloud(r.id).then(() => { toast('Link revoked'); load() }).catch(() => toast('Couldn’t revoke. Try again.', 'error'))}><X size={13} /> Revoke</button>}
                </li>
              )
            })}</ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
