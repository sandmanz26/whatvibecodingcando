import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { IcCheck, IcMic, IcSpark, WDock, WPin } from './Widget'

/**
 * The toolbox's preview screen: pick a tool and a short loop shows how it works, in three steps
 * (the way a game's skill list plays a clip of the move you have selected).
 *
 * These are animated drawings of each flow, built from the same widget drawing as the rest of the
 * page. They are not recordings of the product, and the screen says so.
 */
export type PreviewId = 'comments' | 'prompt' | 'compare' | 'narration' | 'usability' | 'fivesec' | 'heatmap' | 'insights' | 'gaze' | 'report' | 'inspect' | 'dscheck' | 'tokens'

export const STEPS: Record<PreviewId, [string, string, string]> = {
  comments: ['Press Comment', 'Click the thing you mean', 'Write it, post it, get a reply'],
  prompt: ['Open a comment', 'Press Copy fix prompt', 'Paste it into your AI coding tool'],
  compare: ['Pick component A', 'Pick component B', 'Read the style differences'],
  narration: ['Press record and talk', 'Move to the next screen', 'Each screen becomes a chapter'],
  usability: ['Give people a task', 'They try it on the real site', 'See who made it, and how fast'],
  fivesec: ['Show one screen', 'Hide it after five seconds', 'Ask what they remember'],
  heatmap: ['People do the task', 'Every click is collected', 'Read the map, per device'],
  insights: ['One path per participant', 'Their clicks, in order', 'Rage and dead clicks marked'],
  gaze: ['Calibrate with the webcam', 'Check the accuracy', 'Get a gaze heatmap'],
  report: ['Research comes in', 'Findings are ranked', 'Each one links to its evidence'],
  inspect: ['Turn on Inspect', 'Hover any element', 'Token or hard-coded, per value'],
  dscheck: ['Scan the page', 'Off-system values are flagged', 'The nearest token is suggested'],
  tokens: ['Upload a token file', 'Preview it on the page', 'Compare two sets'],
}

/** The customer's page: a headline, a button and three cards, addressable by the scenes. */
function Page({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`pv-page ${className}`}>
      <i className="pg-nav" /><i className="pg-h" /><i className="pg-p" /><i className="pg-btn" />
      <i className="pg-card a" /><i className="pg-card b" /><i className="pg-card c" />
      {children}
    </div>
  )
}
/** A pointer that glides to a new place each step. Positions are in % of the screen. */
function Cur({ at, ph, click }: { at: [number, number][]; ph: number; click?: number[] }) {
  const [x, y] = at[Math.min(ph, at.length - 1)]
  return <i className={`pv-cur ${click?.includes(ph) ? 'click' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}><svg width="18" height="18" viewBox="0 0 22 22"><path d="M3 2l15 7.5-6.5 2L9 18z" fill="#fff" stroke="#0b0f2e" strokeWidth="1.6" strokeLinejoin="round" /></svg></i>
}
const at = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` })
const Row = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => <li><span>{k}</span><code className={ok ? 'ok' : ok === false ? 'bad' : ''}>{v}</code></li>

function Scene({ id, ph }: { id: PreviewId; ph: number }) {
  switch (id) {
    case 'comments': return (
      <Page>
        <span className="pv-abs from1" style={at(27, 39)}><WPin n={1} /></span>
        <div className="pv-card from2" style={at(36, 30)}><b>Rani</b><p>This says “Submit”. Say what happens next.</p><p className="pv-reply"><b>Budi</b> Changed it.</p></div>
        <span className="pv-abs pv-dock"><WDock active={ph === 1} count={ph === 2 ? 1 : 0} /></span>
        <Cur ph={ph} at={[[80, 86], [28, 42], [62, 60]]} click={[0, 1]} />
      </Page>
    )
    case 'prompt': return (
      <Page>
        <span className="pv-abs" style={at(27, 39)}><WPin n={3} /></span>
        <div className="pv-card only01" style={at(36, 26)}><b>Dewi</b><p>The middle plan should say per seat.</p><span className={`pv-chip ${ph === 1 ? 'hot' : ''}`}>{ph === 1 ? <><IcCheck size={11} /> Copied</> : <><IcSpark size={11} /> Copy fix prompt</>}</span></div>
        <div className="pv-term from2"><span>your AI coding tool</span><pre>{'Fix this on /pricing\nElement  .plan:nth-child(2) .price\nScreen   390 × 844\nFeedback “…should say per seat.”'}</pre><em>Fixing .price…</em></div>
        <Cur ph={ph} at={[[60, 40], [50, 58], [78, 80]]} click={[1]} />
      </Page>
    )
    case 'compare': return (
      <Page>
        <i className="pv-outline" style={{ left: '6%', top: '56%', width: '26%', height: '34%' }}><em>A</em></i>
        <i className="pv-outline from1 alt" style={{ left: '68%', top: '56%', width: '26%', height: '34%' }}><em>B</em></i>
        <div className="pv-panel from2"><b>A vs B</b><ul><Row k="radius" v="7px → 10px" ok={false} /><Row k="padding" v="12 → 16" ok={false} /><Row k="font" v="same" ok /></ul></div>
        <Cur ph={ph} at={[[19, 72], [81, 72], [58, 34]]} click={[0, 1]} />
      </Page>
    )
    case 'narration': return (
      <Page className={ph >= 1 ? 'next' : ''}>
        <div className="pv-bar"><i className="pv-recdot" /><span className="pv-wave">{[6, 12, 8, 16, 10, 14, 7, 12, 9, 15, 8, 11].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 70}ms` }} />)}</span><IcMic size={12} /></div>
        <div className="pv-panel from2"><b>Chapters</b><ul><Row k="1 · Home" v="0:21" /><Row k="2 · Pricing" v="0:34" /><Row k="3 · Checkout" v="0:18" /></ul></div>
        <Cur ph={ph} at={[[30, 20], [22, 44], [70, 40]]} click={[1]} />
      </Page>
    )
    case 'usability': return (
      <Page>
        <div className="pv-bar task"><b>Task</b> Find the yearly price <span className="pv-timer">{['0:00', '0:27', '0:42'][ph]}</span></div>
        <svg className="pv-path from1" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M20 40 C40 30 30 70 50 72 S80 50 86 26" /></svg>
        <div className="pv-panel from2"><b>Result</b><ul><Row k="Task" v="Completed" ok /><Row k="Time" v="0:42" /><Row k="Wrong turns" v="2" ok={false} /></ul></div>
        <Cur ph={ph} at={[[20, 40], [50, 72], [86, 26]]} click={[2]} />
      </Page>
    )
    case 'fivesec': return (
      <Page className={ph === 2 ? 'hidden' : ''}>
        <div className={`pv-count only01 ${ph === 1 ? 'late' : ''}`}>{ph === 0 ? '5' : '1'}</div>
        <div className="pv-card from2 q" style={at(22, 26)}><b>What was this page for?</b><p className="pv-input">“Something about pricing plans”</p><b>What would you click first?</b><p className="pv-input">“The orange button”</p></div>
      </Page>
    )
    case 'heatmap': return (
      <Page>
        {[[22, 44], [82, 22], [80, 26], [50, 70], [84, 20], [78, 24], [24, 46], [52, 74]].map(([x, y], i) => <i key={i} className={`pv-dot ${i < 3 ? '' : 'from1'} ${ph === 2 ? 'gone' : ''}`} style={{ ...at(x, y), transitionDelay: `${i * 60}ms` }} />)}
        <i className="pv-blob from2" style={{ left: '66%', top: '6%', width: '30%', height: '34%' }} /><i className="pv-blob from2 soft" style={{ left: '38%', top: '56%', width: '26%', height: '32%' }} /><i className="pv-blob from2 soft" style={{ left: '12%', top: '32%', width: '20%', height: '26%' }} />
        <Cur ph={ph} at={[[82, 24], [50, 72], [90, 60]]} click={[0, 1]} />
      </Page>
    )
    case 'insights': return (
      <Page>
        <svg className="pv-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M12 20 C30 24 22 44 24 46 S60 60 52 74 S84 40 82 24" /></svg>
        {[[12, 20], [24, 46], [52, 74], [82, 24]].map(([x, y], i) => <i key={i} className="pv-step from1" style={{ ...at(x, y), transitionDelay: `${i * 110}ms` }}>{i + 1}</i>)}
        <i className="pv-rage from2" style={at(52, 74)}><em>rage click · 5×</em></i>
        <div className="pv-tag">Participant 3</div>
      </Page>
    )
    case 'gaze': return (
      <Page className={ph < 2 ? 'dim' : ''}>
        <div className="pv-calib only0">{Array.from({ length: 9 }, (_, i) => <i key={i} className={i === 4 ? 'on' : ''} />)}</div>
        <div className="pv-acc only1"><i /><b>Accuracy check</b><span>Good: within 1.2° <small>example</small></span></div>
        <i className="pv-blob from2 gaze" style={{ left: '4%', top: '18%', width: '52%', height: '34%' }} /><i className="pv-blob from2 gaze soft" style={{ left: '30%', top: '56%', width: '34%', height: '36%' }} />
        <div className="pv-tag cam"><i /> webcam · video stays on the device</div>
      </Page>
    )
    case 'report': return (
      <div className="pv-doc">
        {['People miss the yearly toggle', 'CTA label is unclear', 'Nine blues, three in tokens'].map((t, i) => (
          <div key={t} className={`pv-find ${i === 0 && ph === 2 ? 'open' : ''}`} style={{ transitionDelay: `${i * 120}ms` }}>
            <i className="from1">{i + 1}</i><b>{t}</b>
            {i === 0 && <span className="pv-ev from2"><em>heatmap</em><em>3 comments</em><em>usability run</em></span>}
          </div>
        ))}
      </div>
    )
    case 'inspect': return (
      <Page>
        <i className="pv-outline from1 tight" style={{ left: '5.2%', top: '38.5%', width: '22%', height: '13%' }}><em>104 × 30</em></i>
        <div className="pv-panel from2"><b>button.cta</b><ul><Row k="color" v="#2b4bff" ok={false} /><Row k="radius" v="--radius-md" ok /><Row k="font" v="--text-sm" ok /></ul></div>
        <Cur ph={ph} at={[[70, 86], [16, 46], [16, 46]]} click={[0]} />
      </Page>
    )
    case 'dscheck': return (
      <Page>
        <i className="pv-scan only0" />
        <i className="pv-outline from1 bad" style={{ left: '5.2%', top: '38.5%', width: '22%', height: '13%' }} /><i className="pv-outline from1 bad" style={{ left: '37%', top: '56%', width: '26%', height: '34%' }} />
        <div className="pv-panel from2"><b>2 not tokens</b><ul><Row k="#2b4bff" v="--color-primary" ok /><Row k="7px" v="--radius-md" ok /></ul></div>
      </Page>
    )
    default: return (
      <Page className={ph >= 1 ? 'themed' : ''}>
        <div className="pv-file only0"><IcCheck size={11} /> tokens.json</div>
        <div className="pv-panel from2"><b>Set A vs Set B</b><ul><li><span>primary</span><code><i style={{ background: '#1535e6' }} /><i style={{ background: '#0b7a53' }} /></code></li><li><span>radius-md</span><code>10px · 6px</code></li><li><span>contrast</span><code className="ok">AA · AA</code></li></ul></div>
        <Cur ph={ph} at={[[50, 30], [16, 46], [70, 40]]} />
      </Page>
    )
  }
}

/** Plays the three steps on a loop. With reduced motion it rests on the last step. */
export default function Preview({ id }: { id: PreviewId }) {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [ph, setPh] = useState(calm ? 2 : 0)
  useEffect(() => { setPh(calm ? 2 : 0) }, [id, calm])
  useEffect(() => {
    if (calm) return
    const t = window.setTimeout(() => setPh((p) => (p + 1) % 3), ph === 2 ? 2600 : 1500)
    return () => window.clearTimeout(t)
  }, [ph, id, calm])
  return (
    <div className="pv" data-ph={ph}>
      <div className="pv-screen" key={id} aria-hidden><Scene id={id} ph={ph} /></div>
      <ol className="pv-steps">
        {STEPS[id].map((s, i) => <li key={s} className={i === ph ? 'on' : i < ph ? 'past' : ''}><i>{i + 1}</i>{s}</li>)}
      </ol>
    </div>
  )
}
