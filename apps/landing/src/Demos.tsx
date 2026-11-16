import { useEffect, useState } from 'react'
import type { FeatureId } from './content'
import { Browser, IcCheck, IcCopy, IcMic, IcMonitor, IcPhone, IcSpark, WDock, WPin, WThread } from './Widget'

/**
 * One working miniature per feature, drawn like the product. They are demos: each keeps its state
 * in memory, the "recording" uses no microphone, and the only real action is copying the prompt.
 */

const PROMPT = `Fix this on /pricing
Element   .plan:nth-child(2) .price
Screen    390 × 844, mobile
Version   14
Feedback  “The middle plan should say per seat.”`

/** A plain page to put things on: the customer's site, as a wireframe. */
function Wire({ narrow }: { narrow?: boolean }) {
  return (
    <div className={`wire ${narrow ? 'narrow' : ''}`} aria-hidden>
      <i className="wr-nav" /><i className="wr-h" /><i className="wr-p" /><i className="wr-btn" /><i className="wr-tog" />
      <i className="wr-card a" /><i className="wr-card b" /><i className="wr-card c" />
    </div>
  )
}

function Comments() {
  const [done, setDone] = useState(false)
  return (
    <Browser url="your-app.com/pricing" className="d-comments">
      <Wire />
      <WPin n={1} done={done} className="at" />
      <div className="d-float">
        <WThread n={1} author="Rani" time="2 min ago" text="This says “Submit”. It should say what happens next." replies={[{ author: 'Budi', text: 'Changed to “Start free trial”.' }]} done={done} onDone={() => setDone(!done)} meta="on button.cta" />
      </div>
      <div className="d-dock"><WDock count={done ? 0 : 1} /></div>
    </Browser>
  )
}

const BARS = [5, 9, 14, 8, 18, 24, 12, 20, 28, 16, 9, 22, 30, 18, 11, 24, 15, 8, 19, 26, 13, 7, 16, 10, 5, 12, 8, 4]
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Voice() {
  // idle → recording → recorded (→ playing). A drawing of the flow: no microphone is used.
  const [state, setState] = useState<'idle' | 'rec' | 'done' | 'play'>('done')
  const [secs, setSecs] = useState(38)
  const [at, setAt] = useState(0)
  useEffect(() => {
    if (state === 'rec') { const t = window.setInterval(() => setSecs((s) => (s >= 119 ? s : s + 1)), 1000); return () => window.clearInterval(t) }
    if (state === 'play') { const t = window.setInterval(() => setAt((a) => a + 1), 110); return () => window.clearInterval(t) }
  }, [state])
  useEffect(() => { if (state === 'play' && at >= BARS.length) { setState('done'); setAt(0) } }, [at, state])
  return (
    <div className="w w-card d-voice">
      <div className="w-top"><b>New comment</b><span className="w-meta">on section.hero</span></div>
      <p className="w-text">The whole first screen feels crowded, listen:</p>
      {state === 'idle' && <button className="w-rec" onClick={() => { setSecs(0); setState('rec') }}><IcMic size={15} /> Record a voice note <small>up to 2 minutes</small></button>}
      {state === 'rec' && (
        <div className="w-player rec">
          <button className="w-play stop" onClick={() => setState('done')} aria-label="Stop recording"><i /></button>
          <span className="w-wave live" aria-hidden>{BARS.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${(i % 7) * 90}ms` }} />)}</span>
          <span className="w-time">{clock(secs)}</span>
        </div>
      )}
      {(state === 'done' || state === 'play') && (
        <div className="w-player">
          <button className="w-play" onClick={() => { setAt(0); setState(state === 'play' ? 'done' : 'play') }} aria-label={state === 'play' ? 'Stop' : 'Play voice note'}>
            {state === 'play' ? <i /> : <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor" /></svg>}
          </button>
          <span className="w-wave" aria-hidden>{BARS.map((h, i) => <i key={i} className={state === 'play' && i <= at ? 'on' : ''} style={{ height: h }} />)}</span>
          <span className="w-time">{clock(Math.max(secs, 1))}</span>
          <button className="w-ic" onClick={() => setState('idle')} aria-label="Delete voice note">×</button>
        </div>
      )}
      <div className="w-actions"><span className="w-fine">Demo: your microphone isn’t used here.</span><span className="w-grow" /><span className="w-btn">Cancel</span><span className="w-btn primary">Post</span></div>
    </div>
  )
}

function Heat() {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [kind, setKind] = useState<'clicks' | 'gaze'>('clicks')
  return (
    <div className="w w-card d-heat">
      <div className="w-top"><b>Heatmap</b><span className="w-meta">Task: find the yearly price</span></div>
      <div className="d-switches">
        <div className="seg" role="group" aria-label="Device">
          <button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><IcMonitor size={13} /> Desktop</button>
          <button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><IcPhone size={13} /> Mobile</button>
        </div>
        <div className="seg" role="group" aria-label="Heatmap of">
          <button aria-pressed={kind === 'clicks'} onClick={() => setKind('clicks')}>Clicks</button>
          <button aria-pressed={kind === 'gaze'} onClick={() => setKind('gaze')}>Gaze <em>Labs</em></button>
        </div>
      </div>
      <div className={`d-map ${device} ${kind}`}>
        <Wire narrow={device === 'mobile'} />
        <i className="blob x" /><i className="blob y" /><i className="blob z" />
      </div>
      <p className="w-fine">{kind === 'clicks' ? (device === 'desktop' ? 'On desktop, most clicks land on the monthly/yearly toggle.' : 'On mobile, people tap the first card and miss the toggle.') : 'Gaze comes from webcam eye tracking in a usability test. The video never leaves the device.'} <span>Example data.</span></p>
    </div>
  )
}

function Prompt() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(PROMPT) } catch { /* the demo still shows the state */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="d-prompt">
      <WThread n={3} author="Dewi" time="1 h ago" text="The middle plan should say per seat." meta="on .price · mobile">
        <button className="w-btn spark" onClick={copy}>{copied ? <><IcCheck size={13} /> Copied: paste it into your AI tool</> : <><IcSpark size={13} /> Copy fix prompt</>}</button>
      </WThread>
      <div className={`d-clip ${copied ? 'on' : ''}`}><span><IcCopy size={12} /> On your clipboard</span><pre>{PROMPT}</pre></div>
    </div>
  )
}

const FINDINGS = [
  { id: 'c', bad: '#2b4bff', good: '--color-primary', kind: 'Colour', where: '.plan .cta' },
  { id: 'r', bad: '7px', good: '--radius-md', kind: 'Radius', where: '.plan' },
  { id: 't', bad: '13.5px', good: '--text-sm', kind: 'Font size', where: '.plan small' },
]
function DsCheck() {
  const [fixed, setFixed] = useState<string[]>([])
  const left = FINDINGS.length - fixed.length
  const toggle = (id: string) => setFixed((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  return (
    <div className="w w-card d-ds">
      <div className="w-top"><b>Design system check</b><span className={`w-status ${left ? '' : 'done'}`}>{left ? `${left} not ${left === 1 ? 'a token' : 'tokens'}` : 'All tokens'}</span></div>
      <div className={`d-sample ${fixed.map((f) => `fx-${f}`).join(' ')}`} aria-hidden>
        <div className="d-plan"><b>Team</b><small>per seat, billed yearly</small><span>Start free trial</span></div>
      </div>
      <ul>
        {FINDINGS.map((f) => {
          const on = fixed.includes(f.id)
          return (
            <li key={f.id} className={on ? 'on' : ''}>
              <span className="d-find"><b>{f.kind}</b><code>{on ? f.good : f.bad}</code><small>{on ? 'token' : `hard-coded on ${f.where}`}</small></span>
              <button className="sw" role="switch" aria-checked={on} onClick={() => toggle(f.id)} aria-label={`Use ${f.good}`}><i /></button>
            </li>
          )
        })}
      </ul>
      <p className="w-fine">Flip a switch to try the nearest token on the sample above.</p>
    </div>
  )
}

export default function Demo({ id }: { id: FeatureId }) {
  if (id === 'comments') return <Comments />
  if (id === 'voice') return <Voice />
  if (id === 'heatmap') return <Heat />
  if (id === 'prompt') return <Prompt />
  return <DsCheck />
}
