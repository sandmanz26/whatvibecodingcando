import { useRef, useState } from 'react'
import { Play, Eye, Bookmark, BookmarkCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty } from '../components/ui'
import { ScreenDrawer } from '../components/ScreenDrawer'
import { DEFAULT_SCALE, RULE_LABEL, groupHits, readTokens, scanDocument, type Group, type PageResult, type Rule } from '../tools/dscheck/scan'
import { isKept, keep } from '../tools/repo/store'

const PAGES = ['/', '/search?q=running%20shoes', '/product/p1', '/cart', '/checkout', '/orders']
const RULES = Object.keys(RULE_LABEL) as Rule[]
const pathOf = (p: string) => p.split('?')[0]
const queryOf = (p: string) => p.split('?')[1]
const appUrl = (hash: string) => `${window.location.pathname}${window.location.search}#${hash}`
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function DesignCheck() {
  const { toast } = useStore()
  const frame = useRef<HTMLIFrameElement>(null)
  const [pages, setPages] = useState<string[]>(PAGES)
  const [scaleText, setScaleText] = useState(DEFAULT_SCALE.join(', '))
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<PageResult[] | null>(null)
  const [rule, setRule] = useState<Rule | 'all'>('all')
  const [show, setShow] = useState<{ title: string; page: string; sel: string } | null>(null)
  const [, setVer] = useState(0)

  const scale = scaleText.split(/[\s,]+/).map(Number).filter((n) => n > 0)

  const run = async () => {
    const f = frame.current
    if (!f) return
    const out: PageResult[] = []
    for (const p of pages) {
      setRunning(p)
      const [path, q] = [pathOf(p), queryOf(p)]
      const hash = `${path}?${[q, 'embed'].filter(Boolean).join('&')}`
      if (!f.contentWindow || f.contentWindow.location.href === 'about:blank') {
        await new Promise<void>((res) => { f.onload = () => res(); f.src = appUrl(hash) })
      } else {
        f.contentWindow.location.hash = hash
      }
      await wait(900)
      const doc = f.contentDocument!
      await doc.fonts?.ready
      out.push(scanDocument(doc, path, scale, readTokens(doc)))
    }
    setResults(out)
    setRunning(null)
  }

  const groups = results ? groupHits(results).filter((g) => rule === 'all' || g.rule === rule) : []
  const checked = results?.reduce((a, r) => a + r.checked, 0) ?? 0
  const flagged = results?.reduce((a, r) => a + r.flagged, 0) ?? 0
  const byRule = (r: Rule) => results?.reduce((a, p) => a + p.hits.filter((h) => h.rule === r).length, 0) ?? 0

  const keepGroup = (g: Group) => {
    const ex = g.examples[0]
    const added = keep({
      title: `${RULE_LABEL[g.rule]}: ${g.value}`,
      detail: `Used ${g.uses} time${g.uses === 1 ? '' : 's'} on ${g.pages.join(', ')}.${g.suggest ? ` Closest token: ${g.suggest}.` : ''} Example: ${ex.label}.`,
      evidence: `${g.uses} element${g.uses === 1 ? '' : 's'} · design system check`, source: 'design-check', impact: g.uses >= 10 ? 'medium' : 'low', tags: ['Visual'],
      page: ex.page, sel: ex.sel,
    })
    setVer((v) => v + 1)
    toast(added ? 'Kept in the insight repository' : 'Already in the repository')
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Design system check</h1>
          <p>Opens each marketplace screen, reads what the browser actually renders, and flags values that aren’t design tokens: colours, corner radii, fonts, and font sizes off the type scale, plus inline styles set by hand. If a design variant is applied in this browser, the variant is what gets checked.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => void run()} disabled={!!running || !pages.length}><Play size={14} /> {running ? 'Checking…' : results ? 'Check again' : 'Run the check'}</button></div>
      </div>

      <section className="card card-body stack gap-12">
        <div className="field">
          <label>Screens</label>
          <div className="row wrap" style={{ gap: 6 }}>{PAGES.map((p) => <button key={p} className="chip mono" aria-pressed={pages.includes(p)} onClick={() => setPages((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>{p}</button>)}</div>
        </div>
        <div className="field" style={{ maxWidth: 520 }}>
          <label htmlFor="scale">Type scale (px)</label>
          <input id="scale" className="input mono" value={scaleText} onChange={(e) => setScaleText(e.target.value)} />
          <span className="hint">The font sizes the design system allows. Anything else is flagged with the closest size.</span>
        </div>
        {running && <p className="muted" style={{ fontSize: 13 }}>Checking <span className="mono">{running}</span> ({pages.indexOf(running) + 1} of {pages.length})…</p>}
      </section>

      {!results ? (
        !running && <div className="card mt-16"><Empty title="Not checked yet"><span>Choose the screens and run the check. It takes a few seconds.</span></Empty></div>
      ) : (
        <>
          <div className="grid g-4 mt-16">
            <div className="card stat"><div className="stat-label">Consistency</div><div className="stat-value num">{checked ? Math.round(((checked - flagged) / checked) * 100) : 100}%</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>of {checked.toLocaleString('en-US')} elements use only tokens</div></div>
            <div className="card stat"><div className="stat-label">Elements flagged</div><div className="stat-value num">{flagged}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>{groupHits(results).length} distinct values</div></div>
            <div className="card stat"><div className="stat-label">Colours off-token</div><div className="stat-value num">{byRule('color') + byRule('background') + byRule('border')}</div></div>
            <div className="card stat"><div className="stat-label">Type off-scale</div><div className="stat-value num">{byRule('font-size') + byRule('font-family')}</div></div>
          </div>

          <section className="card mt-16">
            <div className="card-head"><div><h2>By screen</h2><p>Share of elements that use only tokens</p></div></div>
            <div className="card-body">
              {results.map((r) => {
                const ok = r.checked ? (r.checked - r.flagged) / r.checked : 1
                return (
                  <div key={r.page} className="funnel-row">
                    <span className="mono">{r.page}</span>
                    <span className="funnel-bar"><i style={{ width: `${ok * 100}%` }} /></span>
                    <b className="num">{Math.round(ok * 100)}%</b>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card mt-16" style={{ overflowX: 'auto' }}>
            <div className="card-head">
              <div><h2>What to fix</h2><p>Each off-token value, how often it’s used, and the closest token</p></div>
              <select className="select" style={{ width: 230 }} value={rule} onChange={(e) => setRule(e.target.value as Rule | 'all')} aria-label="Rule">
                <option value="all">Every rule</option>
                {RULES.map((r) => <option key={r} value={r}>{RULE_LABEL[r]} · {byRule(r)}</option>)}
              </select>
            </div>
            {groups.length === 0 ? <div className="card-body"><Empty title="Nothing off-token here" /></div> : (
              <table className="table">
                <thead><tr><th>Rule</th><th>Value</th><th>Closest token</th><th className="r">Uses</th><th>Screens</th><th>Example</th><th /></tr></thead>
                <tbody>
                  {groups.map((g) => {
                    const ex = g.examples[0]
                    const title = `${RULE_LABEL[g.rule]}: ${g.value}`
                    const kept = isKept(title, ex.page)
                    return (
                      <tr key={`${g.rule}${g.value}`}>
                        <td>{RULE_LABEL[g.rule]}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{['color', 'background', 'border'].includes(g.rule) && <i className="swatch" style={{ background: g.value }} />}{g.value}</td>
                        <td className="mono muted" style={{ fontSize: 12 }}>{g.suggest ?? '—'}</td>
                        <td className="r num">{g.uses}</td>
                        <td className="mono muted" style={{ fontSize: 12 }}>{g.pages.join(', ')}</td>
                        <td style={{ fontSize: 12.5, maxWidth: 220 }}>{ex.label}</td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn ghost sm icon" onClick={() => setShow({ title, page: ex.page, sel: ex.sel })} aria-label={`Show ${title}`} title="Show on screen"><Eye size={13} /></button>
                          <button className="btn ghost sm icon" onClick={() => keepGroup(g)} disabled={kept} aria-label={`Keep ${title}`} title={kept ? 'Kept' : 'Keep in repository'}>{kept ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {/* The screens are opened here, out of sight, one after another. */}
      <iframe ref={frame} title="Screen being checked" className="dscheck-frame" aria-hidden tabIndex={-1} />
      {show && <ScreenDrawer title={show.title} page={show.page} sel={show.sel} onClose={() => setShow(null)} />}
    </main>
  )
}
