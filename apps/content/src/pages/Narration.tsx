import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Download, Trash2, Play, Pause } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty } from '../components/ui'
import { ScreenViewer } from '../tools/insights/ScreenViewer'
import { clock, extOf, getClip } from '../tools/voice/audio'
import { NARRATE_EVENT, NARRATION_CHANGED, audioId, byScreen, clipsOf, loadNarrations, removeNarration, saveNarrations, type Clip, type Narration as N } from '../tools/voice/narration'

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Narration() {
  const { toast } = useStore()
  const [list, setList] = useState(loadNarrations)
  const [view, setView] = useState<'walkthroughs' | 'screens'>('walkthroughs')
  const [sel, setSel] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [range, setRange] = useState<{ id: string; to: number } | null>(null)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const sync = () => setList(loadNarrations())
    window.addEventListener(NARRATION_CHANGED, sync)
    return () => window.removeEventListener(NARRATION_CHANGED, sync)
  }, [])

  const n = list.find((x) => x.id === sel) ?? list[list.length - 1]
  const clips = useMemo(() => (n ? clipsOf(n) : []), [n])
  const current = [...clips].reverse().find((c) => c.from <= now) ?? clips[0]
  const screens = useMemo(() => byScreen(list), [list])

  // Load the selected walkthrough's audio.
  useEffect(() => {
    if (!n) return
    let u: string | null = null
    setNow(0); setPlaying(false)
    void getClip(audioId(n)).then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u) } else setUrl(null) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [n?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const seek = async (c: Clip, onlyThis = false) => {
    if (c.narration.id !== n?.id) { setSel(c.narration.id); setView('walkthroughs'); await new Promise((r) => setTimeout(r, 300)) }
    const a = audio.current
    if (!a) return
    a.currentTime = c.from / 1000
    setRange(onlyThis ? { id: c.narration.id, to: c.to } : null)
    await a.play()
  }
  const download = async (x: N) => {
    const b = await getClip(audioId(x))
    if (!b) return
    const u = URL.createObjectURL(b)
    Object.assign(document.createElement('a'), { href: u, download: `${x.title.replace(/[^\w-]+/g, '-').toLowerCase()}.${extOf(b.type)}` }).click()
    URL.revokeObjectURL(u)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Narration</h1>
          <p>Explain the screens out loud while you go through them. Press the microphone in the dock, walk through the app talking, and press Stop: each screen you visited becomes a chapter, so its explanation can be played on its own — here, or from the dock’s “Explain” button on that screen. The audio stays in this browser.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => { window.location.hash = '#/'; window.setTimeout(() => window.dispatchEvent(new CustomEvent(NARRATE_EVENT, { detail: 'start' })), 150) }}><Mic size={14} /> Start narrating</button></div>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty title="No narrations yet"><span>Start narrating: the app opens on its home screen with a recording bar. Talk as you go; press Stop when you’re done.</span></Empty></div>
      ) : (
        <>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'walkthroughs'} onClick={() => setView('walkthroughs')}>Walkthroughs<span className="count">{list.length}</span></button>
            <button role="tab" aria-selected={view === 'screens'} onClick={() => setView('screens')}>By screen<span className="count">{screens.length}</span></button>
          </div>

          {view === 'screens' ? (
            <div className="stack" style={{ gap: 12 }}>
              {screens.map((s) => (
                <section key={s.page} className="card card-body">
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><b className="mono">{s.page}</b><span className="muted" style={{ fontSize: 12.5 }}>{s.clips.length} explanation{s.clips.length === 1 ? '' : 's'} · {clock(s.ms)}</span></div>
                  {s.clips.map((c, i) => (
                    <button key={i} className="vo-chapter" onClick={() => void seek(c, true)}>
                      <Play size={13} /><span>{c.narration.title}</span><span className="muted num">{clock(c.from)}–{clock(c.to)}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : n && (
            <div className="ses">
              <nav className="ses-list" aria-label="Walkthroughs">
                {[...list].reverse().map((x) => (
                  <button key={x.id} className={`ses-row ${x.id === n.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                    <span className="row" style={{ justifyContent: 'space-between' }}><b>{x.title}</b><span className="muted num">{clock(x.ms)}</span></span>
                    <span className="muted">{when(x.startedAt)} · {x.chapters.length} screen{x.chapters.length === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </nav>
              <section className="stack gap-16" style={{ minWidth: 0 }}>
                <div className="card card-body stack gap-12">
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" style={{ fontWeight: 600 }} value={n.title} onChange={(e) => saveNarrations(list.map((x) => (x.id === n.id ? { ...x, title: e.target.value } : x)))} aria-label="Title" />
                    <button className="btn ghost sm icon" onClick={() => void download(n)} aria-label="Download audio" title="Download audio"><Download size={14} /></button>
                    <button className="btn ghost sm icon danger" onClick={() => { void removeNarration(n.id); setSel(null); toast('Narration deleted') }} aria-label="Delete narration" title="Delete"><Trash2 size={14} /></button>
                  </div>
                  {url ? (
                    <audio ref={audio} controls src={url} style={{ width: '100%' }}
                      onTimeUpdate={(e) => {
                        const t = e.currentTarget.currentTime * 1000
                        setNow(t)
                        if (range && t >= range.to) { e.currentTarget.pause(); setRange(null) }
                      }}
                      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
                  ) : <p className="muted" style={{ fontSize: 13 }}>The audio for this narration isn’t in this browser.</p>}
                  <ol className="vo-chapters">
                    {clips.map((c, i) => (
                      <li key={i}>
                        <button className={`vo-chapter ${current === c ? 'on' : ''}`} onClick={() => void seek(c)}>
                          {current === c && playing ? <Pause size={13} /> : <Play size={13} />}
                          <span className="mono">{c.page}{c.query ? `?${c.query}` : ''}</span>
                          <span className="muted num">{clock(c.from)} · {clock(c.to - c.from)}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
                {current && (
                  <div className="card card-body">
                    <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>The screen follows the narration as it plays.</p>
                    <ScreenViewer page={current.page} query={current.query} device="desktop" mode="live" maxHeight={480} />
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  )
}
