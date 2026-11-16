import { useState } from 'react'
import { Browser, IcLock, WDock, WPin } from './Widget'

/**
 * The safety argument as something to flip: the same page, as a visitor loads it and as a
 * reviewer loads it from a review link. Reviewers-only is the product's default audience.
 */
export default function Audience() {
  const [who, setWho] = useState<'visitor' | 'reviewer'>('visitor')
  const reviewer = who === 'reviewer'
  return (
    <div className="aud">
      <div className="aud-side">
        <div className="seg big" role="group" aria-label="Who is looking">
          <button aria-pressed={!reviewer} onClick={() => setWho('visitor')}>A visitor</button>
          <button aria-pressed={reviewer} onClick={() => setWho('reviewer')}><IcLock size={13} /> A reviewer</button>
        </div>
        <h3>{reviewer ? 'Opened from your review link: the layer is on.' : 'A normal visit: nothing to see, almost nothing to load.'}</h3>
        <p>{reviewer
          ? 'The link carries a one-time token. That browser becomes a reviewer and gets the dock, the pins and the tools you switched on.'
          : 'The script checks whether this browser is a reviewer, finds it isn’t, and stops. No dock, no pins, no widget code.'}</p>
        <dl className="aud-facts">
          <div><dt>Loads</dt><dd>{reviewer ? 'the widget, about 110 kB' : 'a check, about 5 kB'}</dd></div>
          <div><dt>Sees</dt><dd>{reviewer ? 'dock, pins, tools' : 'your site, unchanged'}</dd></div>
          <div><dt>Can comment</dt><dd>{reviewer ? 'yes' : 'no'}</dd></div>
        </dl>
      </div>
      <Browser url={reviewer ? <>your-app.com/<b>#vibe_r=…</b></> : 'your-app.com'} className={`aud-view ${who}`}>
        <div className="aud-page" aria-hidden>
          <i className="ap-nav" /><i className="ap-h" /><i className="ap-p" /><i className="ap-p s" /><i className="ap-btn" />
          <i className="ap-card a" /><i className="ap-card b" /><i className="ap-card c" />
        </div>
        <div className="aud-layer" aria-hidden={!reviewer}>
          <WPin n={1} className="p1" /><WPin n={2} className="p2" /><WPin n={3} done className="p3" />
          <div className="aud-dock"><WDock count={2} /></div>
        </div>
      </Browser>
    </div>
  )
}
