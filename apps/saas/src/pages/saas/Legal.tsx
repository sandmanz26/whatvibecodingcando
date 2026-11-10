import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MousePointer2, TriangleAlert } from 'lucide-react'
import { BRAND } from '../../saas/products'
import '../../saas/saas.css'

/**
 * Privacy policy and terms, written from what the product actually does. They are drafts: before
 * opening sign-up to the public they need a contact address and a legal review (UU PDP, GDPR).
 */

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · ${BRAND}`; window.scrollTo(0, 0) }, [title])
  return (
    <div className="lp lp-legal">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
        <Link to="/landingpage" className="lp-btn ghost sm"><ArrowLeft size={14} /> Website</Link>
      </header>
      <main className="lp-wrap lp-legal-main">
        <h1>{title}</h1>
        <p className="lp-note"><TriangleAlert size={13} /> Draft for the beta, last updated 10 November 2026. It describes what the product does today; it will be reviewed before sign-up opens to everyone.</p>
        {children}
      </main>
    </div>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <h2>What we keep</h2>
      <ul>
        <li><b>Your account:</b> name, email address and a password (stored by our authentication provider as a hash; we never see it).</li>
        <li><b>Your workspace:</b> projects, their site addresses, widget settings and their published versions, and invites you create.</li>
        <li><b>Comments on your sites:</b> the comment and reply text, the page path it was made on, where on the page (the element and position), the time, and the name the reviewer gave.</li>
        <li><b>Reviewers:</b> a reviewer who opens a review link gets an anonymous session for that browser. We keep the name they give and when they were last active; no email or password.</li>
        <li><b>Installation check:</b> the host name of a site where the script ran, its version, and whether the widget showed.</li>
      </ul>
      <h2>What we don’t collect</h2>
      <ul>
        <li>The script never reads what visitors type into your site’s fields, and doesn’t record visitors who aren’t reviewers.</li>
        <li>No advertising or tracking cookies. The browser stores sessions and settings in its own storage only to keep you signed in and the widget working.</li>
      </ul>
      <h2>Who processes it for us</h2>
      <ul>
        <li><b>Supabase</b>: database, authentication and file storage.</li>
        <li><b>Vercel</b>: hosting of this website and the script.</li>
        <li><b>Our email provider</b>: sends account emails (confirmation, password reset).</li>
      </ul>
      <h2>How long, and your choices</h2>
      <ul>
        <li>We keep your data while your account exists. <b>Settings → Delete account</b> deletes the login, the workspace, its projects, comments and reviewers.</li>
        <li>A project owner can remove a reviewer or delete comments at any time.</li>
        <li>To ask for a copy or a correction of your data, contact us.</li>
      </ul>
      <p className="lp-muted">See also the <Link to="/terms">terms of use</Link>.</p>
    </Page>
  )
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <h2>The beta</h2>
      <ul>
        <li>{BRAND} is in beta and free. Features can change; we’ll say so in the panel before something you use goes away.</li>
        <li>Comments are the product that runs on your own site today. Products marked “Early access” work in the demo console only.</li>
      </ul>
      <h2>Your part</h2>
      <ul>
        <li>Install the script only on sites you run or may change, and tell your reviewers that their comments are stored by us.</li>
        <li>Don’t use it to collect personal data from your visitors, or for anything unlawful.</li>
        <li>Keep review links to the people they are for: anyone with a valid link can comment until it expires.</li>
      </ul>
      <h2>Our part</h2>
      <ul>
        <li>We protect your data as described in the <Link to="/privacy">privacy policy</Link>, and never sell it.</li>
        <li>During the beta the service is provided as it is, without guarantees of availability.</li>
      </ul>
    </Page>
  )
}
