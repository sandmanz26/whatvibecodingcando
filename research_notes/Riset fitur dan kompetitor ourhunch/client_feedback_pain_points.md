# Client website feedback, revisions and approval: recurring pain points (user behaviour)

Research date: 2026-11-23. Scope: freelancers, small agencies, AI-tool builders and their clients; global; 2024–2026 evidence preferred.

**Method note and evidence quality (read first).** Reddit was not reachable from this research environment (both the search tool and direct fetches were blocked), so the planned r/web_design, r/freelance and r/agency threads are **missing**. G2, Capterra and Software Advice review pages returned HTTP 403, so review evidence comes from Trustpilot (fetched directly) and search-engine summaries of G2/Capterra. First-hand practitioner evidence comes from Hacker News (via the Algolia API), DEV Community and Product Hunt. Much of the rest is **vendor blog content**, which is labelled as such below: treat its numbers as marketing unless marked "primary". The one solid primary survey is Ignition's 2025 report (US only).

Strength scale used: **High** = several independent first-hand sources plus vendor consensus; **Medium** = one or two first-hand sources plus vendor consensus; **Low** = vendor claims only.

---

## 1. How clients send website feedback today, and why they resist new tools

### Takeaway
Clients still default to the channel they already use: WhatsApp or email with phone photos or blurry screenshots, Slack threads, Zoom calls, and Google Docs. Tools that need a GitHub, Jira or tool account, or a browser extension, get used briefly and then abandoned in favour of email. That pattern has been reported for over a decade (2014) and still in 2025–2026. "No login for the client" has become the standard selling point of nearly every new entrant in 2025–2026. That makes it table stakes, not a differentiator. **Strength: High.**

### Cited Findings
- **WhatsApp, vague descriptions and phone photos of screens (2026, freelance dev making web apps for early startups):** "I usually talk to my clients on whatsapp, but it's super inefficient. They are very vague to describe a problem, and when I ask for screenshots, I get a photo of their screen taken with their phone." He "lost so much time just trying to understand my clients feedback." — [Hacker News, 2026-05-13](https://news.ycombinator.com/item?id=48119687)
- **The full spread of channels (2026, WordPress developer):** "WhatsApp messages with blurry screenshots"; email such as "the thing on the left, make it bigger"; "A Slack thread that spiraled into 47 messages about a single button color"; "A Zoom call that could have been a one-line comment"; "A Jira ticket that references a Google Doc that references another email that nobody can find anymore." The author also tried shared staging links, Loom, annotated screenshots and Google Docs comments: "nothing stuck." Clients forgot which version they were looking at, so changes had to be re-explained on calls, sometimes twice. — [DEV Community, "How I Stopped Chasing Client Feedback Over WhatsApp…"](https://dev.to/jumplinks/how-i-stopped-chasing-client-feedback-over-whatsapp-and-built-a-wordpress-plugin-instead-2np3)
- **Vague bug emails (2025, freelance developer):** "'Something's broken' became my least favorite email." — [Hacker News Show HN (Notedis), 2025-11-14](https://news.ycombinator.com/item?id=45926542)
- **Account friction kills adoption (older, 2014, still relevant):** "Clients, managers and other 'non-developers' usually don't have Github accounts. When we tried making them use Github Issues, most of the time they'd use it for a week and then go back to emailing us or just stop giving feedback." — [Hacker News, 2014](https://news.ycombinator.com/item?id=7172835)
- **Developer tools fail with non-technical clients (older, 2014):** Tools like JIRA Capture, UserVoice and Zendesk "worked really well for us, but our non-technical clients generally hated them, and just fell back to sending us emails"; BugHerd, which runs on the site itself, was what clients accepted. — [Hacker News, 2014](https://news.ycombinator.com/item?id=7214777)
- **Match the tool to the client's comfort (older, 2014):** geek clients stay in GitHub, moderately technical ones in Asana (made to "watch the instructional videos first"), with BugHerd for bugs. — [Hacker News, 2014](https://news.ycombinator.com/item?id=8715766)
- **Friction even in leading tools:** a comparison site says BugHerd asks clients for a name and email on the first comment and creates a guest account, concluding neither option is friction-free for external clients, and that clients "need a small amount of hand-holding" at first. Reviews call the mobile interface "clunky". (Search summary of a competitor's comparison page, so possibly biased.) — [Simple Commenter, Usersnap vs BugHerd](https://www.simplecommenter.com/posts/usersnap-vs-bugherd); [Hackceleration BugHerd review](https://hackceleration.com/labs/review/bugherd)
- **"No login" is now a commodity claim (2025–2026 launches):** Notedis ("clients never need to log in"), Feedash ("No account needed on their end"), Markdrop (commenters praised "No logins for Clients"), Commentblocks ("no signup required"), Huddlekit ("no extension, code or account"), plus BugHerd, Pastel, Simple Commenter, Feedbucket, Layerdock and Aligno. — [PH Notedis](https://www.producthunt.com/products/notedis/launches/notedis-2); [PH Feedash](https://www.producthunt.com/products/feedash); [PH Markdrop](https://www.producthunt.com/products/markdrop-2); [PH Commentblocks](https://www.producthunt.com/posts/commentblocks); [Huddlekit](https://huddlekit.com/); [BugSmash guide to tools without login](https://bugsmash.io/blog/website-feedback-tools-without-login/)
- **Buyer checklists now ask about extension and account:** guides tell agencies to check "whether clients need an account or a browser extension," whether mobile review works, and whether comments sync with the project tool. — [Feedbucket](https://feedbucket.app/); [Lyssna roundup](https://www.lyssna.com/blog/best-website-feedback-tools/)
- **Some prefer email for depth:** an older Indie Hackers thread (about 7 years old) calls emails "the most thoughtful, sincere, and personal" form of feedback. — [Indie Hackers](https://www.indiehackers.com/post/how-are-you-getting-feedback-from-your-users-02fb0c7fd2)

### Inferences
- The client's real alternative is the messaging app already on their phone, not another tool. Anything that adds steps before the first comment (sign-up, extension, email verification, even a name and email form) competes badly with WhatsApp. ourhunch's one-time link with no account fits the observed behaviour, but competitors claim the same, so the message has to be *fewer steps than WhatsApp*, not just "no login".
- The "photo of the screen taken with a phone" behaviour shows that much feedback is given **on mobile**. A widget that works well on a phone browser (tap to pin, voice note) speaks directly to that behaviour. Voice notes match how WhatsApp-heavy clients already talk.
- Version confusion ("which version was I looking at") is a pain point in its own right. Comments that carry page, element, device and *version/time* address it.

### Gaps
- No Reddit evidence (blocked). Reddit threads in r/web_design, r/freelance and r/Wordpress would probably add many more 2024–2026 quotes and should be checked manually.
- No quantitative split of channel usage (what share of clients use WhatsApp, email or calls). I found no reliable survey.

---

## 2. What goes wrong: vague feedback, missing context, scattered channels, revision rounds, scope creep, sign-off, stakeholders, staging

### Takeaway
The most consistently reported failures are vague feedback without context, feedback scattered across channels, and lost version context. These come up first-hand. Scope creep and unbilled revisions are the biggest *money* problem, backed by primary data: 57% of US agencies lose $1k–5k a month and only about 22% regularly bill for out-of-scope work. Conflicting stakeholders, missing approval records and password-protected staging are real but mostly documented by vendors. **Strength: High (vague, scattered, scope creep); Medium (sign-off, stakeholders); Low–Medium (staging auth, mobile).**

### Cited Findings
**Vague feedback and missing context**
- Vague requests via WhatsApp and email are a constant theme ("make it bigger", "something's broken"). — [HN 2026](https://news.ycombinator.com/item?id=48119687); [HN 2025](https://news.ycombinator.com/item?id=45926542); [DEV](https://dev.to/jumplinks/how-i-stopped-chasing-client-feedback-over-whatsapp-and-built-a-wordpress-plugin-instead-2np3)
- Loom and Slack screenshots "lack context, forcing developers to reverse-engineer the issue." (AI-generated idea summary; weak source.) — [boss.cc](https://www.boss.cc/ideas/qoji2EwUk6c/)
- Vendor claim: "67% of unplanned agency revision rounds come from vague, unstructured or late client feedback." The underlying research is unnamed, so this is **unverified**. — [Filestage, cited in search results](https://filestage.io/blog/creative-review-process/)

**Scattered channels and lost feedback**
- Screenshot relays from client to account manager to designer "create a second layer of documentation chaos"; "the feedback itself isn't the problem; where the feedback lives is." (Vendor blog.) — [Revuesuite](https://revuesuite.com/blog/why-feedback-gets-lost-in-whatsapp-threads)
- 47-message Slack thread about one button colour; chains of Jira, Google Docs and email that nobody can trace. — [DEV](https://dev.to/jumplinks/how-i-stopped-chasing-client-feedback-over-whatsapp-and-built-a-wordpress-plugin-instead-2np3)

**Revision rounds and scope creep (money)**
- **Primary (Ignition 2025 Agency Pricing & Cash Flow Report; 273 managers and executives at US agencies in branding, creative, digital, PR, social and website development):** 57% lose $1,000–$5,000 a month on unbilled projects and tasks, 30% say scope creep costs more than $5,000 a month, and 78% "rarely or only sometimes" charge for out-of-scope work. — [Ignition press release](https://www.ignitionapp.com/news/2025-agency-pricing-cashflow-report); [full report page](https://www.ignitionapp.com/2025-agency-pricing-cashflow-report)
  - The Drum reports that only 1% successfully bill for *all* out-of-scope work. Secondary outlets give conflicting splits (B&T says 43%, MediaPost says 70% lose up to $5k), so cite the Ignition figures. — [The Drum](https://www.thedrum.com/news/2025/05/22/cash-flow-crunch-us-agencies-struggle-grow-late-payments-and-scope-creep-bite); [B&T](https://www.bandt.com.au/93-of-agencies-are-raising-prices-but-why-are-so-many-still-leaking-profit/); [MediaPost](https://www.mediapost.com/publications/article/407097/report-agencies-fail-to-leverage-pricing-strategi.html)
- The same report: 71% say at least one in four invoices is paid late, and 84% spend 3–10+ hours a month chasing late payments. This is relevant because sign-off often triggers payment. — [Ignition](https://www.ignitionapp.com/news/2025-agency-pricing-cashflow-report)
- The root cause named across agency blogs is undefined "rounds": "unlimited revisions" or "two rounds included" without defining what a round is. (Vendor and agency blogs.) — [Enterprise DNA](https://enterprisedna.co/resources/blog/agencies-reduce-revision-cycles/); [PlayPause revision policy](https://playpause.io/blogs/agency-revision-policy-scope-creep); [Revuesuite](https://revuesuite.com/blog/unlimited-revisions-money-loss-agencies)
- Old HN thread (2012): "what's an 'iteration'? Is a design of a whole website? What if they want a few tweaks on the about page after the second iteration…" The agency treats anything without comments as automatically approved. — [HN 2012](https://news.ycombinator.com/item?id=4717522)
- Typical norm: 1–2 design revision rounds included, extra rounds billed hourly. (Agency blog summarising Reddit; the Reddit claim is not linked.) — [Cloudpeak](https://cloudpeak.solutions/blog/website-design-revisions-what-to-expect-reddit)
- Benchmarks (vendor, no methodology): an average creative review takes "eight days across three rounds"; 2 rounds is good, 3–4 average, 5 or more a structural problem. Filestage also claims "92% of files get signed off in just two review rounds," which contradicts the three-round average. — [Ziflow](https://www.ziflow.com/blog/creative-approval-audit-trail-compliance); [Ziflow workflow](https://www.ziflow.com/blog/creative-workflow-optimization); [Filestage approval tips](https://filestage.io/blog/creative-approval/)
- Unsourced figures circulating ("revisions consume 30–40% of billable capacity"; "20–25% more hours from scope creep") have **no primary source** and should not be cited as facts. — [Enterprise DNA](https://enterprisedna.co/resources/blog/agencies-reduce-revision-cycles/); [Trakkar](https://trakkar.in/blogs/agency-scope-creep-billing/)

**Late feedback and chasing approvals**
- Vendor survey: 84% of account managers say chasing people for approval slows their work. — [Filestage vs Ziflow](https://filestage.io/filestage-vs-ziflow/)
- Slow client response stalls projects. A DesignCrowd job thread shows a designer repeatedly asking the client for feedback (illustrative only). — [DesignCrowd](https://www.designcrowd.com/jobs/job/4016418/discussion)

**Approval and sign-off disputes**
- Vendor claim: 82% of agency overruns involving client disputes cite a missing formal approval record (unverified). — [Filestage via search results](https://filestage.io/blog/creative-review-process/)
- Recommended practice: record sign-off **on the exact staging version reviewed**, and keep feedback separate from approval so that "every comment [doesn't] reopen an approval." — [Simple Commenter approval workflow](https://www.simplecommenter.com/posts/client-approval-workflow)

**Conflicting stakeholders**
- "Two opposing notes will pause the project until someone decides." The advice is that one client-side coordinator merges the notes and a tie-breaker is named at kickoff. — [PlayPause, corporate stakeholders](https://playpause.io/blogs/conflicting-stakeholder-feedback-video); [Payodin](https://payodin.com/blog/how-to-manage-feedback-from-multiple-stakeholders/); [Dotts](https://dotts.se/articles/how-to-get-feedback-on-website/)
- Vendor claim: late-joining external stakeholders cause 3–4 times more rounds (unverified). — [Filestage via search](https://filestage.io/blog/creative-review-process/)

**Staging and password-protected sites**
- With a feedback snippet behind basic auth, the client still needs the staging username and password "or they see nothing at all." — [Nootiz, staging environments](https://www.nootiz.com/website-feedback/staging-environments)
- Proxy/iframe-based tools break on staging because of X-Frame-Options or CSP headers (blank screen). The workaround of putting credentials in the URL (`user:pass@host`) leaks passwords. — [Workflow.design help](https://www.workflow.design/help/how-to-share-a-staging-website-behind-http-authentication-trtcx); [Discourse meta](https://meta.discourse.org/t/embedded-comments-in-html-page-sameorigin-and-403-issues/50647?tl=pt)
- A Markup.io user complained "the workspace doesn't even load into the live website so all work is double handled!" (GB, Feb 2025). This is the proxy/iframe failure mode. — [Trustpilot Markup.io](https://www.trustpilot.com/review/markup.io)
- Markup.io: "comments disappear from time to time" (CA, Feb 2024); users also say page designs shift slightly when viewed in the tool. — [Trustpilot](https://www.trustpilot.com/review/markup.io); [Capterra Markup](https://www.capterra.com/p/206850/Markup/reviews/)

**Mobile review**
- Clients photograph their screens with phones and send the photos (above). BugHerd's mobile interface is called "clunky" across reviews. — [HN 2026](https://news.ycombinator.com/item?id=48119687); [Hackceleration](https://hackceleration.com/labs/review/bugherd)

### Inferences
- **Coverable by ourhunch today:** vague feedback and missing context (element pin plus page, device and version), scattered channels (one list plus CSV), staging (a script tag runs inside the site, so basic auth only needs to be passed once by the human; there is no proxy or iframe and no X-Frame-Options breakage). This is a concrete selling point against proxy tools such as Markup.io; say "works on password-protected staging" only once it has been tested.
- **Not covered, but high in money terms:** the revision-round and scope-creep problem is about *counting and billing* rounds, not commenting. A lightweight "round" marker (group comments into Round 1/2/3, show "Round 3 of 2 included") plus an "Approve this version" button with name and timestamp would address the two most expensive disputes (unbilled extra rounds and missing approval records) at little build cost.
- Conflicting stakeholders: a reviewer name on every comment plus "resolve or merge" would help, but the main fix is process (one client coordinator). A product nudge such as "send all comments as one batch" could support it.

### Gaps
- No independent (non-vendor) data on average revision rounds for *website* projects specifically; the 8-day, 3-round figure is creative-asset proofing from vendors.
- No first-hand quotes found on sign-off disputes going legal, or on clients reviewing only on mobile (beyond phone photos).
- Ignition is US-only. I found no comparable survey for EU, APAC or LATAM agencies.

---

## 3. What agencies want from feedback tools

### Takeaway
From review complaints and new-tool pitches, what agencies want is: zero client friction, auto-captured context (screenshot, browser, device), sync into their PM tool, predictable cheap pricing (not per seat, not sudden hikes), reliability (comments must never vanish), and lately a hand-off to AI coding tools (MCP or prompt). Sign-off records and round tracking are wanted for disputes, but are mostly argued for in vendor content. **Strength: Medium–High for pricing, friction and context; Medium for integrations; Low–Medium for approval and white-label (little first-hand evidence found).**

### Cited Findings
- **Pricing anger is the top complaint in reviews (2025–2026).** Markup.io: "We paid 29 USD per month, then it jumped to 79 USD. With zero added value" and "at 79 USD you only get up to 50 markups per month" (BG, Oct 2026); "went up 280% from last year" (US, Aug 2025); "nearly $1,000 per year" (US, Nov 2025); "they've removed features from the free plan progressively" (US, May 2025); "Pay the 280% upgrade, or they DELETE your entire space and all projects" (US, Aug 2025); foreign-currency card fees on a USD plan for a UK SMB (Feb 2025). — [Trustpilot Markup.io](https://www.trustpilot.com/review/markup.io)
- **BugHerd:** per-seat cost complaints; one G2 reviewer says pricing "is mostly set up for companies and corporations"; adding members is $8/user/month; the tier with project-tool sync roughly triples the bill; some say it "has not evolved much." G2 rating is about 4.7. (Search summary of G2 plus a third-party review.) — [G2 BugHerd](https://www.g2.com/products/bugherd/reviews); [Hackceleration](https://hackceleration.com/labs/review/bugherd)
- **Small-business clients can't justify $50–60/month tools:** "Looked at Marker.io ($60/mo) and UserSnap ($50/mo)… my small business clients couldn't justify the cost." — [HN 2025](https://news.ycombinator.com/item?id=45926542). Another builder chose to build open source because existing tools didn't suit them. — [HN 2026](https://news.ycombinator.com/item?id=48119687)
- **Auto-captured context:** the desired flow is "Click on site → leave feedback → I get emailed with screenshot + context." — [HN 2025](https://news.ycombinator.com/item?id=45926542). BugHerd was valued early for auto-capturing "browser data and even screenshots." — [HN 2014](https://news.ycombinator.com/item?id=7061424)
- **Feedback only, without a tracker:** "I'm using bugherd and would like to have the feedback part only as I don't need the bug tracking part (already using another tool for that)." (2014.) — [HN](https://news.ycombinator.com/item?id=7839927)
- **Integrations and missing tools:** G2's own summary says users are "frustrated with the lack of tools in BugHerd," with limited third-party integrations. — [G2 BugHerd pros and cons](https://www.g2.com/products/bugherd/reviews?qs=pros-and-cons)
- **Markup.io feature gaps:** comments are only a "bubble" (no delete/add/highlight markup types); users want to archive resolved comments because the list grows long; the support chat bubble confuses clients ("customers are confused because they see the Intercom bubble from MarkUp Support"). That last point is a white-label signal: clients should not see the vendor's branding. — [Capterra Markup](https://www.capterra.com/p/206850/Markup/reviews/)
- **AI coding hand-off is emerging (2025–2026):** Feedbucket advertises an MCP integration for AI coding assistants; the 2026 HN builder took UI inspiration from agentation.dev, a tool for annotating UI for AI agents. — [Feedbucket blog](https://feedbucket.app/blog/website-feedback-tool); [HN 2026](https://news.ycombinator.com/item?id=48119687)
- **Video and screen recording:** Feedbucket and BugHerd pitch auto video and screenshots so that "clients don't need a screen-sharing call" (vendor). — [Feedbucket](https://feedbucket.app/blog/website-feedback-tool); [BugHerd use case](https://bugherd.com/use-case/website-feedback-tool)
- **Optional login for named reviewers:** Simple Commenter offers no-login by default and login for named reviewers who get email reply notifications. This suggests agencies want client notifications without forcing accounts. — [Simple Commenter](https://www.simplecommenter.com/website-feedback-tool)

### Inferences
- ourhunch's $2/site/month answers the strongest emotional complaint in this market (price hikes, per-seat pricing, SMB clients who cannot justify $50+). Recommend making "flat, per site, no seats, price locked" explicit, and promising never to delete data on downgrade: read-only plus export instead, which directly answers the Markup.io "DELETE your entire space" fear.
- "Copy as AI fix prompt" is ahead of most incumbents and fits the 2025–2026 AI-builder trend. MCP or direct hand-off to Cursor or Claude Code is the next step competitors are already taking (Feedbucket).
- Highest-value gaps for ourhunch, by evidence and cost: (1) client reply notifications by email without an account; (2) an approve/sign-off record per version; (3) round counter; (4) one-way push to Trello/ClickUp/Linear/Slack (many want feedback only, with tracking in their own tool); (5) removing ourhunch branding from the client view (the white-label signal from the Markup.io Intercom confusion). Console logs and session replay matter mainly to dev-heavy teams; they are lower priority for non-technical SMB clients and raise privacy issues, and ourhunch's own rules forbid reading host field values.

### Gaps
- G2, Capterra and Software Advice pages were blocked (403), so review-frequency counts per complaint category could not be computed.
- No first-hand data on how many agencies actually need white-label versus just "no vendor branding visible to the client."
- No first-hand evidence on demand for due dates or assignment from small freelancers (likely low; it is mostly agency-sized teams).

---

## 4. Data and surveys on time lost, revision rounds and delays

### Takeaway
Only one robust primary dataset was found: Ignition 2025 (US, n=273) on unbilled scope creep and late payment. Revision-round and review-time figures come from proofing vendors (Ziflow, Filestage) without methodology, and they contradict each other. **Strength: High for Ignition; Low for the rest.**

### Cited Findings
- Ignition 2025: 57% lose $1k–5k a month unbilled; 30% more than $5k; 78% rarely or only sometimes bill out-of-scope work; 71% have one in four or more invoices paid late; 84% spend 3–10+ hours a month chasing payments; only 16% require full upfront payment. n=273 US agency managers and executives. — [Ignition](https://www.ignitionapp.com/news/2025-agency-pricing-cashflow-report)
- Creative review averages 8 days and 3 rounds (vendor); pharma up to 40 days. — [Filestage](https://filestage.io/blog/creative-review-process/); [Ziflow](https://www.ziflow.com/blog/creative-approval-audit-trail-compliance)
- One Ziflow customer went from 3–4 proofing rounds to 1.6 after clients marked up work directly in a shared space (single case study, vendor). — [Ziflow via Yespress](https://yespress.io/ziflow)
- 84% of account managers say chasing approval slows them down (Filestage survey, methodology not shown). — [Filestage](https://filestage.io/filestage-vs-ziflow/)

### Inferences
- For marketing claims, ourhunch should lean only on Ignition-style primary numbers (for example "most agencies lose $1k–5k a month to unbilled extra work") and avoid repeating the unsourced 67% and 82% figures.
- The Ziflow 3–4 to 1.6 case suggests that in-context markup reduces rounds, but it is a single vendor case. A measured ourhunch statistic (rounds per project before and after) would be a stronger sales asset.

### Gaps
- No primary data on hours per week freelancers spend interpreting feedback.
- No non-US agency surveys found on this topic.

---

## 5. Behaviour differences by client type and region

### Takeaway
Non-technical SMB owners give feedback through the messaging app they already use, often on their phone, and abandon tools that need accounts. Enterprise and corporate clients bring multiple conflicting stakeholders and need a single consolidated set of notes plus formal approval. In mobile-first, WhatsApp-dominant markets (India, Brazil, Indonesia, much of LATAM and SE Asia), WhatsApp is the default business channel, so the "feedback via WhatsApp photo" pattern is likely even stronger there. Direct regional evidence on *website feedback* behaviour, however, was not found. **Strength: Medium for client type; Low–Medium for region (inferred from general WhatsApp data).**

### Cited Findings
- **Non-technical clients:** they hated developer tools and fell back to email (2014). They send WhatsApp phone photos and vague descriptions (2026). — [HN 2014](https://news.ycombinator.com/item?id=7214777); [HN 2026](https://news.ycombinator.com/item?id=48119687)
- **SMB budget:** small-business clients could not justify $50–60/month tools (2025). — [HN](https://news.ycombinator.com/item?id=45926542)
- **Micro-businesses don't learn new UIs (adjacent domain, 2025):** "micro operators don't have the time to learn yet another UI." — [HN 2025](https://news.ycombinator.com/item?id=44087474)
- **Corporate and enterprise:** multiple stakeholders give conflicting notes; the recommended fix is one coordinator and a named tie-breaker; approval should be formal and tied to the version. — [PlayPause](https://playpause.io/blogs/conflicting-stakeholder-feedback-video); [Simple Commenter](https://www.simplecommenter.com/posts/client-approval-workflow)
- **WhatsApp reach by market (aggregator data, mixed quality):** India has the largest WhatsApp Business user base (about 481M downloads cited for 2024), with Indonesia second (121–128M; sources conflict). Brazil has about 148M users (about 85% penetration) and Indonesia about 112M (about 91% penetration). SMBs are about 77% of WhatsApp Business users (Meta figure via aggregator, undated). — [Business of Apps](https://www.businessofapps.com/data/whatsapp-statistics/); [Rasayel](https://learn.rasayel.io/en/blog/whatsapp-user-statistics/); [Infobip](https://www.infobip.com/blog/whatsapp-statistics-2025-global-usage-market-overview); [Backlinko](https://backlinko.com/whatsapp-users)
- **European small teams also run work on personal WhatsApp:** a 2026 Show HN says "Many small teams in Europe run their work on personal c[hat apps]." — [HN 2026](https://news.ycombinator.com/item?id=50209218)
- **Payment friction for non-US buyers:** a UK SMB complained that a USD plan "attracts payment fees from UK banks each month as its a foreign payment" (Feb 2025). — [Trustpilot Markup.io](https://www.trustpilot.com/review/markup.io)

### Inferences
- For WhatsApp-heavy markets the review link must be **shareable inside WhatsApp and open well in a phone browser**: a link preview, no app install, a large tap target to pin, and voice notes, since voice messages are a normal WhatsApp habit. A "send to WhatsApp" share button on the review link is a cheap, high-fit feature.
- Local-currency pricing or a flat low price limits foreign-card fees; $2 is small enough that FX fees are proportionally annoying, so annual billing or local payment methods may matter in India, Brazil and Indonesia.
- Enterprise clients would value approval records and named reviewers more than SMBs do; SMB owners value zero setup most. ourhunch's core (no account, pin, voice) suits the SMB and freelancer segment best, and approval and rounds would extend it to small agencies with corporate clients.

### Gaps
- No first-hand regional evidence (no Indonesian, Indian or Brazilian freelancer forum posts were retrieved) on how website feedback is given there; local-language searches (for example "revisi website klien WhatsApp", "feedback do cliente site WhatsApp") were not run within the tool budget and are recommended.
- No data on what share of clients review on mobile versus desktop.

---

### Summary table: pain point → evidence strength → ourhunch coverage

| Pain point | Strength | Today's workaround | ourhunch today | Opportunity |
|---|---|---|---|---|
| Vague feedback, no context | High | Ask for screenshots, calls | Covered (pin, page, element, device) | Show version/time on each comment |
| Scattered channels (WhatsApp, email, Slack, docs) | High | Manual copy into spreadsheet or Jira | Partly covered (one list, CSV) | Push to Trello/ClickUp/Linear/Slack |
| Client won't create an account or install an extension | High (but now table stakes) | Fall back to email | Covered (one-time link) | Market as "fewer steps than WhatsApp" |
| Mobile and phone-photo feedback | Medium | Phone photos | Likely covered (script on page) | Mobile-first pin UX, voice, WhatsApp share |
| Scope creep and unbilled rounds | High (primary data) | Contracts, time logs | Not covered | Round counter and "round X of Y included" |
| Missing approval record or disputes | Medium (vendor) | Email "approved", PDFs | Not covered | "Approve this version" with name and timestamp, exportable |
| Conflicting stakeholders | Medium | One client coordinator | Partly covered (reviewer per comment) | Group by reviewer, batch submit |
| Password-protected staging | Medium | Credentials in URL, IP allowlists | Probably works (script runs in page) | Test and say so; advantage over proxy tools |
| Price hikes, per-seat pricing, data deleted on downgrade | High (reviews) | Switch tools or build own | Strong ($2/site) | Price lock, never delete (read-only plus export) |
| Hand-off to AI coding tools | Emerging (2025–26) | Manual prompts | Covered (AI fix prompt) | MCP or Cursor/Claude Code integration |
| Client sees vendor branding or support bubble | Low–Medium | None | Unknown | Neutral, unbranded client view |
