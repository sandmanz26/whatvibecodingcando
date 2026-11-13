import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MousePointer2 } from 'lucide-react'
import { BRAND } from '../../saas/products'
import { cloud } from '../../saas/supabase'
import '../../saas/saas.css'

/**
 * The user guide (#/guide): how to set up a project, get feedback and run studies, written from what
 * the product does today. Public, like the legal pages, and linked from the website and the panel.
 */

const SECTIONS = [
  { id: 'start', title: 'Get started in 5 steps' },
  { id: 'concepts', title: 'How it fits together' },
  { id: 'reviewers', title: 'Invite reviewers' },
  { id: 'comments', title: 'Comments' },
  { id: 'design', title: 'Design tools' },
  { id: 'research', title: 'Research studies' },
  { id: 'heatmaps', title: 'Heatmaps and eye tracking' },
  { id: 'results', title: 'Finding your results' },
  { id: 'privacy', title: 'Privacy and your data' },
  { id: 'trouble', title: 'Troubleshooting' },
] as const

export function Guide() {
  const [here, setHere] = useState<string>(SECTIONS[0].id)
  useEffect(() => { document.title = `User guide · ${BRAND}`; window.scrollTo(0, 0) }, [])
  useEffect(() => {
    // Highlights the section being read in the contents.
    const io = new IntersectionObserver((es) => { const e = es.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (e) setHere(e.target.id) }, { rootMargin: '0px 0px -70% 0px' })
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el) })
    // The last sections are too short to reach the top: at the bottom of the page, the last one is current.
    const end = () => { if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setHere(SECTIONS[SECTIONS.length - 1].id) }
    window.addEventListener('scroll', end, { passive: true })
    return () => { io.disconnect(); window.removeEventListener('scroll', end) }
  }, [])
  // The site uses hash routes, so in-page links scroll instead of changing the address.
  const go = (id: string) => { setHere(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return (
    <div className="lp lp-legal">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
        <span className="lp-row"><Link to="/app" className="lp-btn sm">Open your panel</Link><Link to="/landingpage" className="lp-btn ghost sm"><ArrowLeft size={14} /> Website</Link></span>
      </header>
      <div className="lp-wrap gd">
        <nav className="gd-toc" aria-label="Contents">
          <b>Contents</b>
          {SECTIONS.map((s) => <button key={s.id} type="button" className={here === s.id ? 'on' : ''} aria-current={here === s.id ? 'true' : undefined} onClick={() => go(s.id)}>{s.title}</button>)}
        </nav>
        <main className="lp-legal-main gd-main">
          <h1>User guide</h1>
          <p className="lp-lead">{BRAND} adds comments, usability research and design checks to a website you already have, with one line of code. This guide walks through setting up a project, inviting people and reading what they tell you.</p>

          <section id="start">
            <h2>Get started in 5 steps</h2>
            <ol className="gd-steps">
              <li><b>Create an account</b> and pick the tools you want. You can change them later, per project, in <i>Setup → Products</i>.</li>
              <li><b>Create a project.</b> A project is one website or app. Give it a name, and the address where it’s online (for example <code>shop.example.com</code>). The widget only shows on addresses you list, so nobody can use your snippet on another site. Not online yet? Leave it empty and try everything on the demo site first.</li>
              <li><b>Install the snippet.</b> Copy it from <i>Setup → Install</i> and paste it before <code>&lt;/body&gt;</code> on every page (or in the shared layout, so one place covers every page). The page shows how to do it in HTML, Vite, Next.js, WordPress, Webflow and Framer. You paste it once: it never changes.</li>
              <li><b>Update your site.</b> In <i>Setup → Widget</i>, check the settings and press <i>Update site</i>. Your site follows them on its next page load.</li>
              <li><b>Open your site.</b> Press <i>Open my site</i> on <i>Setup → Install</i>. Only reviewers see the widget (you too), and this makes your browser one. The installation check on the same page says when the script last ran and, if the widget stayed hidden, why.</li>
            </ol>
          </section>

          <section id="concepts">
            <h2>How it fits together</h2>
            <dl className="up-dl">
              <dt>Snippet</dt><dd>One script tag with your project id. It holds no settings, so you never have to change it on your site.</dd>
              <dt>Widget settings</dt><dd>Everything else (tools, look, who sees it, on which sites) is set in <i>Widget</i>. Your edits only reach your site when you press <i>Update site</i>. Every update is kept in <i>History</i>, so you can restore earlier settings.</dd>
              <dt>Who sees it</dt><dd>By default <b>reviewers only</b>: visitors don’t see anything. You can open Comments to everyone visiting; the design tools always stay reviewers-only.</dd>
              <dt>Where (environments)</dt><dd>The addresses the widget may show on: production, staging, preview links, <code>localhost</code>. Each can be switched off on its own.</dd>
              <dt>The off switch</dt><dd>The switch on <i>Overview</i> hides the widget on every site at once. Comments are kept.</dd>
              <dt>Products</dt><dd>Turning a tool on in <i>Products</i> shows an <i>Update site</i> button; your site gets the tool once you press it.</dd>
            </dl>
          </section>

          <section id="reviewers">
            <h2>Invite reviewers</h2>
            <p>Reviewers are the people whose feedback you want: clients, teammates, testers. They don’t need an account.</p>
            <ol className="gd-steps">
              <li>Make a review link in <i>Team → Reviewers</i> (or <i>Widget → Share with a reviewer</i>).</li>
              <li>Send it however you like: email, chat, a ticket.</li>
              <li>When they open it, the widget appears on your site for them, and they stay a reviewer in that browser.</li>
            </ol>
            <p>Links can be revoked from <i>Team</i>. {cloud ? '' : 'In this browser-only beta, review links work on the demo site; on your own domain they need the server.'}</p>
          </section>

          <section id="comments">
            <h2>Comments</h2>
            <ul>
              <li><b>Leave one:</b> press <i>Comment</i> (or the <kbd>C</kbd> key), click any element, type. The pin sticks to that element, so it follows layout changes.</li>
              <li><b>Status:</b> a comment is <i>Open</i>, <i>Ongoing</i> once someone replies, and <i>Completed</i> when resolved.</li>
              <li><b>Component review (A vs B):</b> pick two elements and say which should change.</li>
              <li><b>Voice notes:</b> record a spoken comment on a screen instead of typing.</li>
              <li><b>Versions:</b> every comment records the site version it was made on, so you can filter by release.</li>
              <li><b>Share and export:</b> in <i>Results → Comments</i>, share a read-only list with a link (no account needed, revocable) or download a CSV for a spreadsheet.</li>
            </ul>
          </section>

          <section id="design">
            <h2>Design tools</h2>
            <p>These show as buttons beside <i>Comment</i>, for reviewers only. They read the page in the reviewer’s browser; nothing is sent.</p>
            <ul>
              <li><b>Inspect:</b> hover anything to see its colours, font and spacing, and whether they are design tokens.</li>
              <li><b>Design system check:</b> lists colours, radii and fonts on the page that aren’t tokens, with the nearest token to use.</li>
              <li><b>Design tokens:</b> load a tokens file (W3C, Tokens Studio, CSS variables), apply it to the page to preview, and compare two sets.</li>
            </ul>
          </section>

          <section id="research">
            <h2>Research studies</h2>
            <p>Studies run on your real site with people who agree to take part. {cloud ? '' : 'They need the server, which this browser-only beta doesn’t have.'}</p>
            <ol className="gd-steps">
              <li>Go to <i>Results → All studies</i> and press <i>New study</i>.</li>
              <li>Pick a kind:
                <ul>
                  <li><b>Usability test:</b> tasks such as “find a gift under $20”, each with an optional success rule (reaching a page or clicking an element) and a time limit.</li>
                  <li><b>5-second test:</b> a page is shown briefly, then people answer what they remember.</li>
                  <li><b>Heatmap visit:</b> people use the site freely for a few minutes; their clicks build a heatmap.</li>
                </ul>
              </li>
              <li>Optional: <b>eye tracking</b> (webcam) and <b>fake doors</b> (a button for a feature that doesn’t exist yet, to measure interest).</li>
              <li>Press <i>Participant link</i> and send it. Each participant sees a consent screen first and can say no. A link works for 30 days, up to the number of people you set.</li>
              <li>Open <i>Results</i> on the study: success rate and time per task, where people got stuck, answers, where people looked, and each participant’s run.</li>
            </ol>
            <p>Only people who opened a study’s link are ever recorded. Visitors who didn’t are not.</p>
          </section>

          <section id="heatmaps">
            <h2>Heatmaps and eye tracking</h2>
            <p>Open a heatmap from a study’s results, or with the <i>Heatmap</i> button on your site (reviewers). The heatmap is drawn over the real page, and is built to read true:</p>
            <ul>
              <li><b>One device at a time</b> (desktop, tablet, phone), because the same button sits in a different place on each.</li>
              <li><b>Each person counts the same</b> (on by default), so one person who clicked 200 times doesn’t outweigh everyone else.</li>
              <li><b>Gaze becomes fixations:</b> raw eye samples are grouped into the moments a person actually looked at something, weighted by how long.</li>
              <li><b>Poor calibration is left out:</b> eye tracking less accurate than about 220 px is left out by default, and the heatmap says how many people that was.</li>
              <li><b>Pages with ids are combined:</b> <code>/product/12</code> and <code>/product/98</code> count as one page, <code>/product/:id</code>.</li>
            </ul>
            <p><b>Getting good eye tracking:</b> ask participants to sit at arm’s length in good, even light (no window behind them), keep their head fairly still, and follow the calibration dots carefully. Every click they make afterwards fine-tunes it. The video never leaves their browser and is never stored: only the points they looked at are kept.</p>
          </section>

          <section id="results">
            <h2>Finding your results</h2>
            <p>In your panel, <i>Results</i> lists one page per tool that collects data, and only for the tools that are on:</p>
            <ul>
              <li><b>Comments</b>, <b>Component reviews</b>, <b>Voice notes</b>: what reviewers left.</li>
              <li><b>Usability tests</b>, <b>5-second tests</b>, <b>Heatmaps</b>, <b>Eye tracking</b>, <b>Fake doors</b>: the studies of that kind, each with its results.</li>
              <li><b>Sessions</b>: participants’ paths through the site, step by step.</li>
              <li><b>Report</b>: comments and studies turned into ranked findings you can copy or download.</li>
            </ul>
            <p><i>Overview</i> sums it up: open comments, reviewers, studies and participants, and what’s left to set up.</p>
            <h3>Download your results</h3>
            <ul>
              <li><b>Comments:</b> <i>CSV</i> on the comment list (page, kind, version, status, author, text, replies).</li>
              <li><b>A study:</b> on its results, <i>Participants (CSV)</i> (one row per person: device, accuracy, each task’s outcome, time and clicks, answers) and <i>Clicks, pages and gaze (CSV)</i> (every recorded event, which is what the heatmap is made of).</li>
              <li><b>Sessions:</b> the same two files for every participant of every study.</li>
              <li><b>Report:</b> copy it as Markdown, download it, or print it to PDF.</li>
            </ul>
            <h3>Delete results</h3>
            <ul>
              <li><b>One comment:</b> the bin on it. <b>Several:</b> filter the list, then <i>Delete these</i>.</li>
              <li><b>One participant:</b> the bin on their row in the study’s results.</li>
              <li><b>A study’s results and heatmap:</b> <i>Clear results</i> on the study. The study and its link stay, so you can run it again.</li>
              <li><b>Everything of one kind:</b> <i>Settings → Data</i> (all comments, all research data and heatmaps, install reports, reviewers, links).</li>
            </ul>
          </section>

          <section id="privacy">
            <h2>Privacy and your data</h2>
            <ul>
              <li>The widget never reads what people type into your site’s fields.</li>
              <li>Email addresses, phone numbers and long numbers in element labels are replaced before anything is saved.</li>
              <li>Mark anything sensitive on your site with <code>data-private</code> (for example <code>&lt;div data-private&gt;</code>); it’s recorded only as “(private)”.</li>
              <li>Delete single comments, a study’s results, or everything of one kind (<i>Settings → Data</i>, after typing the project id). Deleting your account deletes everything.</li>
              <li>Read the <Link to="/privacy">privacy policy</Link> and <Link to="/terms">terms</Link>.</li>
            </ul>
          </section>

          <section id="trouble">
            <h2>Troubleshooting</h2>
            <dl className="up-dl">
              <dt>The widget doesn’t show</dt><dd><b>Most often: you opened your site as a visitor.</b> By default only reviewers see the widget, and that includes you. Press <i>Open my site</i> on <i>Setup → Install</i> or <i>Overview</i> once; this browser then keeps seeing it. Otherwise <i>Setup → Install</i> says why it stayed hidden. Other reasons: the settings aren’t on your site yet (press <i>Update site</i>); the site’s address isn’t in <i>Widget → Website</i>; the widget is switched off; or you’re a visitor, not a reviewer (open a review link).</dd>
              <dt>My site has a Content-Security-Policy</dt><dd>Allow the script’s address in <code>script-src</code> (the address is on the Install page). If the site enforces Trusted Types with a list of policy names, add <code>vibe-collab</code> to it.</dd>
              <dt>Staging or preview links</dt><dd>Add them under <i>Widget → Website</i>; each can be on or off.</dd>
              <dt>A study link doesn’t open</dt><dd>Turn the study’s tool on in <i>Products</i> and press <i>Update site</i>. Links also stop after 30 days, after their participant limit, or when revoked; make a new one.</dd>
              <dt>Eye tracking is left out of the heatmap</dt><dd>The participant’s calibration was too inaccurate. Untick “Leave out eye tracking…” in the heatmap to see it anyway, or run the study again with better light.</dd>
            </dl>
          </section>
        </main>
      </div>
    </div>
  )
}
