import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BRAND, PRICING, WEBSITE } from '../../saas/products'
import { analyticsOn } from '../../lib/analytics'
import '../../saas/saas.css'
import { BrandMark } from '../../components/BrandMark'

/**
 * Privacy policy and terms of service, written from what the product actually does. Words in
 * [brackets] are for the owner to fill (list in docs/LEGAL-TODO.md); a lawyer reviews them before
 * anyone is charged.
 */

const UPDATED = '25 November 2026'
const CONTACT = 'hello@ourhunch.com'
const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
/** An owner placeholder: visible on purpose until filled. */
const Fill = ({ children }: { children: React.ReactNode }) => <mark className="lp-fill">[{children}]</mark>

function Page({ title, short, children }: { title: string; short: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · ${BRAND}`; window.scrollTo(0, 0) }, [title])
  return (
    <div className="lp lp-legal">
      <header className="lp-wrap lp-signup-head">
        <a href={WEBSITE} className="lp-logo"><span className="lp-mark" aria-hidden><BrandMark size={17} /></span>{BRAND}</a>
        <a href={WEBSITE} className="lp-btn ghost sm"><ArrowLeft size={14} /> Website</a>
      </header>
      <main className="lp-wrap lp-legal-main">
        <h1>{title}</h1>
        <p className="lp-muted">Last updated {UPDATED}. Questions? Write to <Mail />.</p>
        <section className="lp-legal-short" aria-label="The short version">
          <h2>The short version</h2>
          {short}
        </section>
        {children}
      </main>
    </div>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy policy" short={
      <ul>
        <li>We keep what it takes to run {BRAND}: your account, your projects and the feedback on them.</li>
        <li>On your site, the script records nobody unless they opened a review link or agreed to a study.</li>
        <li>We never record typed text or field values. Webcam video never leaves the participant’s browser.</li>
        <li>No ads, no selling data, no session recordings of you.</li>
        <li>For your reviewers’ and participants’ data, you are in charge; we handle it for you.</li>
        <li>Delete your account any time in Settings, and everything goes with it.</li>
      </ul>
    }>
      <h2>1. Who we are</h2>
      <p>{BRAND} is run by <Fill>Legal name</Fill>, <Fill>address</Fill>, Indonesia (“we”). For anything about your data, write to <Mail />.</p>

      <h2>2. If you have an account</h2>
      <ul>
        <li><b>Account:</b> your name and email address. If you use a password, our sign-in provider stores only a hash of it. If you sign in with an email code, we email you the code. If you choose “Continue with Google”, Google gives us your name and email address, never your Google password.</li>
        <li><b>Workspace:</b> projects, the site addresses you add, widget settings and their published versions, invites and team members.</li>
        <li><b>Feedback on your sites:</b> comments and replies, the page they were made on, the element and position, the device size and browser type, the time, and the site version.</li>
        <li><b>Install check:</b> the host name of a site where your script ran (only your project’s own sites), the script version and whether the widget showed.</li>
        <li><b>Email preferences</b> and a log of which emails we sent you, so nothing is sent twice.</li>
      </ul>

      <h2>3. If you are a reviewer</h2>
      <ul>
        <li>Opening a review link gives your browser an anonymous session. We keep the name you type and when you were last active. No email or password is needed.</li>
        <li>We keep the comments, replies, approvals and voice notes you choose to post. Deleting a comment deletes its voice note too.</li>
      </ul>

      <h2>4. If you take part in a study</h2>
      <ul>
        <li>Nothing is recorded until you press <b>I agree</b> on the study’s consent screen.</li>
        <li><b>What is kept:</b> where you click (page address without its query, position, which element and a short label of it), the pages you open, task times and results, and your answers to the study’s own questions.</li>
        <li><b>Never kept:</b> what you type into the site, field values, video of your screen, or cookies of yours. Emails, phone numbers and long numbers in labels are removed before anything is sent. Parts of a page marked private stay private.</li>
        <li><b>Eye tracking</b> is asked for separately and can be refused. The camera picture is turned into estimated gaze points inside your browser and then dropped. Video never leaves your browser and is never stored. Only gaze points and the calibration accuracy are kept.</li>
        <li>Your study data is tied to an anonymous browser session, not to your name or email.</li>
      </ul>

      <h2>5. If you visit a site that uses {BRAND}</h2>
      <p>The script loads on the page, but it records nothing about you unless you open a review link or agree to a study. It never reads what you type into the site, and it stays in its own sealed box on the page.</p>

      <h2>6. Analytics on our own site</h2>
      {analyticsOn
        ? <p>On our website and in the app (never on customers’ sites, never in the script) we use PostHog to count visits and named steps, like “signed up” or “installed the snippet”. One first-party cookie holds a random id; when you are signed in, we link it to your account id only. No session recordings, no automatic click capture, no comment text, field values, emails or names.</p>
        : <p>This build runs no product analytics. If we turn it on, it will be PostHog on our website and app only (never on customers’ sites), counting named steps like “signed up”, with no recordings, no comment text, field values, emails or names.</p>}

      <h2>7. Emails</h2>
      <ul>
        <li><b>Service emails:</b> sign-in codes, password resets, and project emails to its team (new comments, replies, test results, approvals, reminders, a weekly summary). Change them per project in Settings → Notifications.</li>
        <li><b>Tips and product updates:</b> a welcome email and a few setup tips, only to the person who signed up, never to reviewers or participants. Every one has a one-click unsubscribe link that works without signing in. You can also turn tips off in Settings → Notifications.</li>
      </ul>

      <h2>8. Who helps us run it</h2>
      <ul>
        <li><b>Supabase</b>: database, sign-in and file storage (servers in Singapore).</li>
        <li><b>Vercel</b>: hosting of the website, the app and the script.</li>
        <li><b>Resend</b>: sending emails.</li>
        <li><b>PostHog</b>: website and app analytics, when it is on (section 6).</li>
        <li><b>Cloudflare Turnstile</b>: a bot check on sign-in forms, when it is on.</li>
        <li><b>Google</b>: only if you choose “Continue with Google”.</li>
        <li><b>A payment provider</b> <Fill>name</Fill>: only once billing is switched on and you choose a paid plan. We never see your full card number.</li>
      </ul>
      <p>These companies may handle data outside your country, including in Singapore and the United States. We choose providers that protect data with contracts, such as standard contractual clauses, where the law asks for them.</p>

      <h2>9. How long we keep it</h2>
      <ul>
        <li>As long as your account exists. <b>Settings → Delete account</b> deletes your login, workspace, projects, comments, reviewers and study data.</li>
        <li>Project owners can delete single comments, remove reviewers, and clear one participant’s data or all study data (Settings → Data) at any time.</li>
        <li>Backups made by our database provider expire on their own schedule, usually within days.</li>
      </ul>

      <h2>10. How we protect it</h2>
      <p>Every table is locked by row-level security, so each account reaches only its own data. Traffic is encrypted. The script’s requests are checked for origin, reviewer and rate limits. Secrets stay on the server. No system is perfect: if a breach affects you, we will tell you and the authorities as the law requires.</p>

      <h2>11. Your sites’ data: you are in charge</h2>
      <p>For your reviewers’ and participants’ data, you are the <b>controller</b> and we are your <b>processor</b>. That means:</p>
      <ul>
        <li>We use it only to run {BRAND} for you, never for our own marketing, and we never sell it.</li>
        <li>Our people and providers keep it confidential, and we tell you about a breach without undue delay.</li>
        <li>We help you answer your people’s requests, and delete the data when you delete it or your account.</li>
        <li>You tell your visitors and participants what you collect and why, and get consent where your law asks for it.</li>
      </ul>
      <p>Need a signed data processing agreement? Write to <Mail />.</p>

      <h2>12. Cookies and browser storage</h2>
      <p>We use your browser’s storage to keep you signed in and remember settings. Analytics adds one first-party cookie when it is on. No advertising cookies, no tracking across sites.</p>

      <h2>13. Children</h2>
      <p>{BRAND} is for businesses and is not meant for children under 16. Don’t run studies with minors without the consent your law requires.</p>

      <h2>14. Your rights</h2>
      <p>Wherever you live, you can ask to see, correct, export or delete your data, object to or limit how we use it, and withdraw consent. This covers your rights under the GDPR and UK GDPR, the California CCPA/CPRA (we do not sell or share data for ads), and Indonesia’s Personal Data Protection Law (UU No. 27 of 2022). Write to <Mail />; we answer within 30 days. If you are a reviewer or participant, we may pass your request to the site owner who invited you. You can also complain to your data protection authority.</p>

      <h2>15. Changes</h2>
      <p>When we change this policy we update the date above. If a change matters, we tell account holders by email or in the app first.</p>

      <p className="lp-muted">See also the <Link to="/terms">terms of service</Link>.</p>
    </Page>
  )
}

export function Terms() {
  return (
    <Page title="Terms of service" short={
      <ul>
        <li>{BRAND} is in beta and free. You won’t be charged until billing is switched on and you choose a plan.</li>
        <li>Your content stays yours. We only use it to run the service for you.</li>
        <li>Use it on sites you run, and tell people what you record. No unlawful tracking.</li>
        <li>It’s a beta: no uptime promise, and some features (AI prompts, eye tracking) are experimental.</li>
        <li>You can leave any time and delete everything in Settings.</li>
      </ul>
    }>
      <h2>1. The service</h2>
      <p>{BRAND} lets teams collect feedback and run usability studies on their own websites with a small script, and manage it all in a panel. It is run by <Fill>Legal name</Fill>, Indonesia (“we”). By creating an account you agree to these terms.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give a real email address and keep your sign-in safe. You are responsible for what happens in your account and for the people you invite.</li>
        <li>You must be at least 16 and able to make a contract where you live.</li>
      </ul>

      <h2>3. Using it fairly</h2>
      <ul>
        <li>Install the script only on sites you run or are allowed to change.</li>
        <li>No unlawful tracking. Don’t use {BRAND} to collect personal data from visitors who are not reviewers or participants.</li>
        <li>Get participants’ consent, tell them who you are and why you run the study, and tell your visitors where your law requires it.</li>
        <li>Don’t run studies on pages that show sensitive data (health, payments, ID documents) without clear consent. Mark private parts of pages with <code>data-private</code>.</li>
        <li>Keep review links to the people they are for. Anyone with a valid link can comment until it expires.</li>
        <li>No abuse, spam, malware, or attempts to break or overload the service.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>Comments, voice notes, study results and settings belong to you (or the people who wrote them). You give us a limited licence to store, process and show them only to run {BRAND} for you. We don’t sell it. Our <Link to="/privacy">privacy policy</Link> explains how we handle it.</p>

      <h2>5. Beta, plans and pricing</h2>
      <ul>
        <li>During the beta, {BRAND} is free.</li>
        <li>After the beta, Pro is planned at <b>{PRICING.proPerSite} per site per month</b>. The first {PRICING.foundingCustomers} customers keep a founding price of <b>{PRICING.foundingPerSite} per site per month</b>.</li>
        <li>Nothing is charged until billing is switched on <i>and</i> you choose a plan. We tell you before that happens.</li>
        <li>Features may change during the beta; we say so in the panel before something you use goes away.</li>
      </ul>

      <h2>6. Cancelling and refunds</h2>
      <p>You can cancel any time; a paid plan then runs to the end of the period you paid for. Refunds: <Fill>refund policy, e.g. a full refund within 14 days of the first payment</Fill>.</p>

      <h2>7. Availability</h2>
      <p>During the beta there is no uptime guarantee (no SLA). We work to keep it running and your data safe, but it may sometimes be down or slow.</p>

      <h2>8. Experimental features</h2>
      <ul>
        <li><b>AI prompts</b> turn feedback into suggestions. They can be wrong or incomplete; check them before you act on them.</li>
        <li><b>Eye tracking</b> is a Labs feature. Accuracy depends on the webcam, light and person; treat results as a hint, not a measurement.</li>
      </ul>

      <h2>9. Liability</h2>
      <p>{BRAND} is provided “as is”. As far as the law allows, we are not liable for indirect damages or lost profits, and our total liability is limited to what you paid us in the 12 months before the claim (or USD 50 if you paid nothing). Nothing here limits liability that the law does not allow us to limit.</p>

      <h2>10. Ending things</h2>
      <p>You can delete your account any time in Settings → Delete account. We may suspend or close accounts that break these terms, and tell you why when we can. When an account closes, its data is deleted.</p>

      <h2>11. Law</h2>
      <p>These terms are governed by the laws of <Fill>to be confirmed by the owner — e.g. Indonesia</Fill>.</p>

      <h2>12. Changes</h2>
      <p>We update the date above when these terms change, and tell account holders about important changes before they apply.</p>

      <h2>13. Contact</h2>
      <p>Write to <Mail />.</p>
    </Page>
  )
}
