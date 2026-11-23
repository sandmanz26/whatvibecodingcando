# Competitor landscape: lightweight UX research, behaviour analytics and on-site feedback tools (as of Nov 2026)

Context: ourhunch is one script tag. It runs consented usability tasks (success rate, time), 5-second tests, click heatmaps, webcam eye tracking (Labs), pinned comments and voice notes, and client review links on the live site. Pricing is Free (1 site) and Pro at $2/site/month. It does not record ordinary visitors.

Method and caveats:
- Research was done on 2026-11-23.
- Official pricing pages were fetched directly for Contentsquare/Hotjar, Maze, Lyssna and PostHog. All other prices come from third-party roundups or aggregators, which often conflict. Each is labelled "(3rd-party)" and should be treated as uncertain until checked on the vendor's page.
- Several comparison articles are written by competitors (UXtweak, Maze, Featurebase, Listen Labs, Formbricks, Koji). They are marked "vendor-written".

## 1. Behaviour analytics: heatmaps, session replay, on-site surveys (Hotjar/Contentsquare, Clarity, PostHog, Crazy Egg, Mouseflow, FullStory, LogRocket)

### Takeaway
The heatmap and replay category has been squeezed to free at the low end:
- Microsoft Clarity is free and has no traffic caps.
- PostHog gives 5,000 replays a month free.
- Hotjar's free tier is now part of Contentsquare.

Paid entry tiers start at about $25–$49/month and rise steeply from there. Every tool in this group records all visitors by default. In the EU that now depends on a consent banner (Clarity has enforced consent since 31 Oct 2025), so a "no recording of normal visitors" stance stands out as a real difference.

### Cited Findings

**Hotjar (now Contentsquare)**
- hotjar.com/pricing returns a 301 redirect to contentsquare.com/pricing. Hotjar's pricing has been folded into Contentsquare's "Experience Analytics" and "Voice of Customer" plans — [Contentsquare pricing (official)](https://contentsquare.com/pricing/?utm_source=hotjar-pricing); [Contentsquare support: Hotjar is now part of Contentsquare](https://support.contentsquare.com/hc/en-us/articles/37271913608721-Hotjar-is-now-part-of-Contentsquare)
- **Experience Analytics plans:**
  - Free: $0, up to 200k monthly sessions.
  - Growth: $49/month billed monthly, or $39/month billed annually (20% off). Covers 7k to 240k+ sessions.
  - Pro and Enterprise: custom pricing, 1M sessions to unlimited.
  - The calculator showed $35/month for 7k sessions with a bundle discount.
  - [Contentsquare pricing (official)](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
- **Replay sampling:**
  - Free keeps 1 month of data and captures 5% of sessions (max 10k).
  - Growth keeps 2 months and captures 15%.
  - Pro and Enterprise can capture up to 100%.
  - Heatmaps are on all plans; zone-based heatmaps and heatmap summaries start at Growth.
  - [Contentsquare pricing (official)](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
- **Voice of Customer (surveys and feedback widgets):**
  - Free: 100 responses/month and 3 widgets/surveys.
  - Growth: from $79/month (annual billing), 500 to 100k responses.
  - Pro: custom.
  - [Contentsquare pricing (official)](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
  - Third-party sources disagree. One gives VoC Growth from $99/month, and one says buying both Growth products starts at $148/month — [Zoho PageSense comparison (vendor-written)](https://www.zoho.com/pagesense/conversion-playbook/compare/pagesense-vs-hotjar-contentsquare.html)
- **AI:**
  - Free includes MCP access, limited to 300 tool calls/month.
  - Growth adds "Sense" chat, the Sense Mapping assistant and Sense Analyst lite (beta).
  - Pro and Enterprise offer advanced Sense Analyst as an add-on.
  - [Contentsquare pricing (official)](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
- **Review complaints:**
  - Pricing "can get steep quickly", and essential features sit in higher tiers.
  - Masking sensitive form fields in recordings needs extra code.
  - Reporting can feel slow on large volumes.
  - Growth is shown in euros on Hotjar's site but in dollars on G2, which makes USD budgeting unclear.
  - Heatmaps and recordings are consistently praised.
  - G2 rating is about 4.3 from roughly 300–345 reviews.
  - Sources: [TrustRadius Hotjar vs Maze](https://www.trustradius.com/compare-products/hotjar-vs-maze-user-testing); [Formbricks Hotjar review 2026 (vendor-written, competitor)](https://formbricks.com/blog/hotjar-review); [G2 Hotjar vs Clarity](https://www.g2.com/compare/hotjar-vs-microsoft-microsoft-clarity)

**Microsoft Clarity**
- **Pricing:** "free, forever". There are no traffic limits and no paid upgrade — [Clarity pricing (official)](https://clarity.microsoft.com/pricing?clang=en)
- **Features:** heatmaps, session recordings and Copilot AI summaries (Copilot features can be turned off in Settings) — [Clarity Copilot guide (official)](https://clarity.microsoft.com/blog/?p=5358)
- **2025–26 additions:**
  - Conversational "Ask Clarity" analytics.
  - An "Agent Activity" dashboard that tracks AI agents visiting a site, plus agent task simulations. This rests on secondary sources and is unconfirmed.
  - [ppc.land](https://ppc.land/microsoft-adds-copilot-to-clarity-analytics/)
- **Consent enforcement:**
  - From 31 Oct 2025, sites must send a consent signal before Clarity collects data or sets cookies for visitors in the EEA, UK and Switzerland.
  - Consent Mode is on by default for those regions.
  - Without consent, recordings, heatmaps and funnels may be limited or unavailable.
  - [Clarity blog: cookie consent update (official)](https://clarity.microsoft.com/blog/clarity-cookie-consent-update/); [MS Learn consent mode](https://learn.microsoft.com/en-ca/clarity/consent-mode); [Usercentrics](https://usercentrics.com/knowledge-hub/microsoft-clarity-consent-signal-enforcement/?output_format=md)
- **Complaints:**
  - No custom event tracking or funnel building, according to G2 reviewers.
  - Some reviewers report buggy recordings.
  - G2 rating is about 4.5 on a smaller review base.
  - [G2 compare](https://www.g2.com/compare/hotjar-vs-microsoft-microsoft-clarity); [heatmap.com comparison (vendor-written)](https://www.heatmap.com/blog/microsoft-clarity-vs-hotjar)

**PostHog**
- **Free monthly allowances and first paid tiers:**
  - Product analytics: 1M events free, then $0.00005 per event.
  - Session replay: 5,000 recordings free, then $0.005 per recording (5k–15k).
  - Surveys: 1,500 responses free, then $0.10 per response.
  - Feature flags: 1M requests free.
  - [PostHog pricing (official, pricing.md)](https://posthog.com/pricing.md)
- **AI:**
  - PostHog AI: 500 credits free, then $0.01 per credit.
  - "Replay vision": 2,500 credits free, then $0.01 per credit.
  - [PostHog pricing (official)](https://posthog.com/pricing.md); [Replay vision pricing](https://posthog.com/replay-vision/pricing)
- **Heatmaps, clickmaps and scrollmaps:** included at no separate price — [PostHog FAQ](https://posthog.com/faq). One third-party guide claims the free plan limits heatmaps to 3 pages; this may be outdated or wrong — [Tailkits](https://tailkits.com/tools/posthog/)
- **Replay allowance cut:** the free web replay tier was reportedly reduced from 15K to 5K — [Beton teardown, DEV Community (3rd-party)](https://dev.to/beton/posthog-pricing-teardown-2026-57oo)
- **Seats:** usage-based billing with no per-seat charges — [PostHog pricing](https://posthog.com/pricing)

**Crazy Egg (3rd-party, conflicting)**
- One source lists Starter $29/month, Plus $99/month, Pro $249/month and Enterprise $599/month, all billed annually, with no free plan — [piperocket (3rd-party)](https://piperocket.digital/alternative/crazy-egg-alternatives/)
- Another says a free plan now exists — [wiserreview (3rd-party)](https://wiserreview.com/blog/hotjar-alternatives/)

**Mouseflow (3rd-party)**
- Plans: Free, Essential $25/month (5k sessions, billed yearly), Advanced $109/month, Premium $319/month — [costbench (3rd-party)](https://costbench.com/software/session-replay/mouseflow/)

**FullStory (3rd-party)**
- Free: 30,000 sessions/month, 12-month retention, up to 10 users.
- Business, Advanced and Enterprise: quote only.
- Estimated paid floor: about $10k–15k/year (unverified).
- [inspectlet guide (3rd-party, vendor-written by a competitor)](https://www.inspectlet.com/guides/best-session-recording-tools); [artisangrowthstrategies (3rd-party)](https://www.artisangrowthstrategies.com/blog/best-session-replay-tools-2026)

**LogRocket (3rd-party, conflicting)**
- No free-forever plan; access starts with a 14-day trial.
- Core is cited at $176/month, up from about $69. An older source says $83/month billed yearly for 10k sessions.
- [piperocket LogRocket alternatives (3rd-party)](https://piperocket.digital/alternative/logrocket-alternatives/)

### Inferences
- A $2/site tool cannot win on heatmaps or replay alone, because Clarity is free and unlimited. The heatmap feature in ourhunch is table stakes. It sells only as part of the "consented tasks + review" bundle.
- Clarity's EU consent enforcement and Hotjar's 5% replay sampling on Free mean free tools are getting less complete in Europe. ourhunch's consent-first, participant-only model can be positioned as "no cookie banner needed for recording ordinary visitors". This only holds if the legal reading is checked: participants still consent, and comments and identity storage still need to be disclosed.
- The heatmap and replay tools have AI summaries (Clarity Copilot, Contentsquare Sense, PostHog AI/Replay vision). Users will increasingly expect an "AI summary of results" even in small tools.

### Gaps
- Crazy Egg, Mouseflow, FullStory and LogRocket prices were not verified on the vendors' own pages; the sources conflict.
- No exact date was found for Hotjar's full move to Contentsquare branding. Whether hotjar.com still sells a separate Hotjar SKU is unclear (the pricing URL redirects).
- PostHog heatmap limits on the free plan are unconfirmed.

## 2. Unmoderated and moderated UX testing platforms (Maze, Lyssna, Useberry, UXtweak, Optimal Workshop, Userlytics, UserTesting, Lookback)

### Takeaway
Dedicated testing platforms charge about $80–$200+/month for small teams (Lyssna Growth is $166/month), or are enterprise-only (Maze, UserTesting). Live-website testing is usually locked behind the paid or enterprise tier, and participant panels are paid per response on top. Free tiers are tiny: Maze allows 1 study/month, Useberry 10 responses/month, UXtweak 15 responses/month. This leaves room for a cheap tool that does live-site tasks with participants you recruit yourself.

### Cited Findings

**Maze** (official page)
- The pricing page now shows only two plans:
  - **Free:** 1 study/month, 5 seats, prototype testing, surveys, pay-per-use panel credits. No live website testing and no AI-moderated interviews.
  - **Enterprise:** custom pricing, unlimited seats, advanced live website testing, moderated interviews and panel. AI-moderated interviews are a paid add-on.
- "Team and Organization plans" are mentioned but neither described nor priced. The earlier self-serve Starter tier appears to be gone or hidden; this is uncertain.
- [Maze pricing (official)](https://maze.co/pricing/)
- **Complaints:**
  - Maze sometimes breaks the responsiveness of the product being tested, and its analytics are less useful — [TrustRadius](https://www.trustradius.com/compare-products/hotjar-vs-maze-user-testing)
  - Mid-tier prices are shown only after sign-up — [Intervool (3rd-party)](https://intervool.com/best-usability-testing-tools)

**Lyssna (formerly UsabilityHub)** (official page)
- **Free:** $0, unlimited quick studies, 3 seats, 15 self-recruited responses, panel access, user interviews.
- **Growth:** $166/month, 5 in-depth studies/month (60/year), 5 seats, unlimited self-recruited responses. Adds live website testing, mobile testing, think-aloud recordings, AI follow-up questions, AI summaries, conditional logic, custom branding and an MCP server.
- **Enterprise:** talk to sales; adds SSO and SOC2.
- **Panel:** priced separately, either pay-as-you-go or bulk credits. No per-response price is published.
- The page has a monthly/annual toggle, but only $166/month was extracted.
- [Lyssna pricing (official)](https://www.lyssna.com/pricing/)

**Optimal Workshop (3rd-party)**
- Starter at about $199/month billed annually, 5 studies/year, unlimited seats. Enterprise is custom.
- Earlier sources say $208/month; annual billing only.
- Known for card sorting, tree testing and IA work.
- [UXtweak blog (vendor-written, competitor)](https://blog.uxtweak.com/information-architecture-tools/); [Great Question (vendor-written)](https://www.greatquestion.com/blog/usability-testing-tools-comparison)

**Useberry (3rd-party, conflicting)**
- Free: 10 responses/month.
- Paid tiers vary by source:
  - Growth about €83/month and Business about €659/month, or
  - Growth $79/month, or
  - Pro $33/month billed annually.
- Prototype-focused (Figma etc.).
- [Maze Useberry alternatives (vendor-written)](https://maze.co/compare/useberry-alternatives/); [Evelance (3rd-party)](https://evelance.io/blog/best-alternatives-to-useberry/); [askdecode (3rd-party)](https://www.askdecode.ai/resources/blog-articles/useberry-alternatives)

**UXtweak (3rd-party, conflicting)**
- Free: 15 responses/month, 1 active study.
- Paid: from €129/month, or Plus at $80/month billed annually. Business on request.
- Has website testing, session recording and heatmaps inside studies.
- [UXtweak usability testing tools (vendor-written)](https://www.uxtweak.com/usability-testing/tools-and-software/); [Great Question (vendor-written)](https://www.greatquestion.com/blog/maze-alternatives)

**Userlytics (3rd-party, conflicting)**
- Per-session pricing from about $34–$69 per session; Premium about $699/month.
- Includes a global participant panel.
- [CleverX (3rd-party)](https://cleverx.com/blog/alternatives-to-usertesting-9-best-platforms-for-user-research-in-2026/); [theysaid (3rd-party)](https://www.theysaid.io/blog/blog-best-usertesting-alternatives)

**UserTesting**
- Enterprise pricing on request, typically in the five-figure annual range — [CleverX (3rd-party)](https://cleverx.com/blog/12-best-user-research-tools-2026-12-platforms-ranked-and-reviewed/)

**Lookback (3rd-party, conflicting)**
- Annual plans: Freelance $299/year, Team $1,782/year, Insights Hub $4,122/year, Enterprise from $18,150/year.
- Others cite $24–25/user/month or $149/month for Team.
- Moderated and unmoderated sessions with bring-your-own participants.
- [Guideflow (3rd-party)](https://www.guideflow.com/blog/best-user-research-tools); [alphonsolabs (3rd-party)](https://www.alphonsolabs.com/best-user-research-tools-2026/)

### Inferences
- Maze appears to have dropped a public self-serve paid tier and moved upmarket, leaving freelancers with Free (1 study/month, no live site) or an enterprise sales call. Lyssna's live-site testing starts at $166/month. Combined with the small free tiers elsewhere, this is the clearest gap for ourhunch: live-site task testing with self-recruited participants at about $2/site/month is roughly 50–80x cheaper than the cheapest paid live-site option found.
- Recruitment panels are the moat for Lyssna, Maze, Userlytics and UserTesting. ourhunch has none. Freelancers and agencies usually test with their client's users, or send the link to the client and stakeholders, so the "review link" flow fits this audience better than a panel. A pay-per-response panel partner could be a later upsell.
- AI summaries and AI follow-up questions are now standard in paid tiers (Lyssna Growth, Maze add-on).

### Gaps
- Official current prices for Useberry, UXtweak, Optimal Workshop, Userlytics and Lookback were not fetched; the third-party figures conflict.
- The Lyssna annual price and the per-response panel price are not published.
- No independent G2 complaint data was found for Lyssna, Useberry or UXtweak within the time budget.

## 3. In-product surveys / NPS and feature-request boards (Sprig, Survicate, Canny, Featurebase)

### Takeaway
Survey tools aimed at product teams start at about $100+/month (Sprig appears to have moved to sales-led pricing). Feature-request boards have free tiers but charge $29–$79+/month once a team grows. These are adjacent rather than direct competitors. ourhunch's pinned comments and review links overlap more with website-feedback and visual-annotation tools (section 5).

### Cited Findings
- **Sprig:**
  - No longer lists pricing publicly.
  - Older (2024) data says paid plans from $175/month; others cite Growth at about $500/month or about $10k+/year.
  - [CleverX (3rd-party)](https://cleverx.com/blog/best-user-research-tools-2026-12-platforms-ranked-and-reviewed/); [userintuition (3rd-party)](https://www.userintuition.ai/posts/best-user-research-platforms-saas-2026/)
- **Survicate:** from $114/month billed annually, 10-day free trial. A single source; uncertain — [cpoclub (3rd-party)](https://cpoclub.com/tools/user-research-tools/)
- **Canny:**
  - Free: 25 tracked users, unlimited posts and boards, changelog.
  - Pro: $79/month annual or $99/month monthly for 100 tracked users, scaling with tracked users.
  - The $19 Core tier was reportedly retired mid-2026.
  - [Formbricks Canny pricing (vendor-written, competitor)](https://formbricks.com/blog/canny-pricing); [Capterra](https://www.capterra.com/p/161103/Canny/pricing/); [UserJot (vendor-written)](https://userjot.com/blog/canny-pricing)
- **Featurebase:** free plan with unlimited end users and feedback; paid from $29/seat/month — [Featurebase blog (vendor-written)](https://www.featurebase.app/blog/canny-pricing)
- **PostHog surveys:** 1,500 free responses/month — the cheapest product-survey option for small teams — [PostHog pricing](https://posthog.com/pricing.md)

### Inferences
- NPS and survey features are commoditised by PostHog (1,500 free responses) and Hotjar/Contentsquare Free (100 responses). ourhunch should not compete on surveys. A post-task question (SEQ/SUS-style) inside its usability tasks is the natural, cheap addition.

### Gaps
- Sprig's and Survicate's current official 2026 prices are unverified.

## 4. Predictive attention and webcam eye tracking (Attention Insight, Neurons, Expoze, RealEye, GazeRecorder)

### Takeaway
Predictive-attention AI (no participants) is sold at about $20–$480/month (Attention Insight, Expoze) up to around €15k/year (Neurons). Real webcam eye tracking (RealEye) costs hundreds of dollars a month, and its typical accuracy of about 100 px means it shows rough areas, not precise elements. A $2/site webcam eye-tracking feature has essentially no price competitor, but accuracy must be communicated honestly, which supports keeping it labelled "Labs".

### Cited Findings
- **Attention Insight:**
  - Solo about $23/month and Team $479/month (5 seats, 500 credits) per Capterra/GetApp; G2 (June 2026) lists 3 editions from $31 to $324.
  - Claims to be trained on 70,000 eye-tracking studies, with 96% accuracy (vendor claim).
  - [Capterra](https://www.capterra.com/p/184334/Attention-Insight/pricing/); [G2](https://www.g2.com/products/attention-insight/pricing); [Rocketium (3rd-party)](https://rocketium.ai/academy/all/attention-heatmap-tools)
- **Expoze:**
  - Core €19.99/month, Core+ €199.99/month, Pro €399.99/month.
  - Claims "95% accuracy", no participants needed (vendor claim).
  - [Dynamic Business](https://dynamicbusiness.com/ai-tools/expoze-visual-attention-prediction-tool.html); [Software Advice](https://www.softwareadvice.com/marketing/expoze-io-profile/)
- **Neurons (Predict):** enterprise, custom quotes. Listings put it around €15,000/year for 5 seats (3rd-party estimate) — [Rocketium](https://rocketium.ai/academy/all/attention-heatmap-tools)
- **RealEye:**
  - **Accuracy:** typically about 110 px at up to 60 Hz, per its homepage and features page. Its FAQ says about 106 px on desktop and about 56 px on mobile, and its education page says about 127 px. The vendor's own figures vary.
  - **Commercial pricing:** Basic $390/month or $3,900/year; Standard $990/month or $9,900/year (pricing page accessed Aug 2026, via a third party). Another 2026 review says pricing is not public.
  - **Trial:** 7-day free trial.
  - [RealEye home](https://www.realeye.io/); [RealEye FAQ](https://www.realeye.io/about/faq); [anygen guide (3rd-party)](https://www.anygen.io/showcase/realeye/index.html); [coldiq (3rd-party)](https://coldiq.com/tools/realeye)
- **GazeRecorder:**
  - Accuracy about 1.43° (1.3° with a chin rest) in an academic systematic review.
  - Free for research use, with no commercial licences offered (per the review). A comparison site lists it as freemium; this may be outdated.
  - [Systematic review, U. Hawaii ScholarSpace](https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/0169fe63-b583-4df4-9365-c6e8df04ea11/content); [SaaSHub](https://www.saashub.com/compare-gazerecorder-vs-realeye)

### Inferences
- Predictive attention is a cheap "instant" alternative to real eye tracking. A small tool could add an AI-predicted attention map of a page as a no-participant teaser that funnels into real tests. It would compete with Expoze's €19.99 tier.
- Webcam eye tracking at about 100 px accuracy supports area-of-interest analysis, not element-level analysis. ourhunch should present gaze as AOI/zone heatmaps and say so plainly.

### Gaps
- No confirmed 2026 vendor-page pricing was found for Neurons, Expoze, Attention Insight or GazeRecorder.

## 5. Website feedback, visual annotation and client review tools (Marker.io, BugHerd, Userback, Pastel, Ruttl)

### Takeaway
This is the closest competitive set to ourhunch's "pinned comments + client review links" for freelancers and agencies. Prices are about $18–$59/month, usually per seat or per team, with Jira-style integrations held back for higher tiers. None of them combines review comments with usability tasks and heatmaps.

### Cited Findings
- **Marker.io:**
  - Starter: $39/month annual or $59/month monthly, 3 users.
  - Team: $149/month annual or $199/month monthly, 15 users.
  - No free plan; 15-day trial.
  - [Feedbucket (vendor-written, competitor)](https://feedbucket.app/alternatives/marker-io-alternatives); [doboard (vendor-written)](https://www.doboard.com/blog/best-website-feedback-tools/)
- **BugHerd:** Standard $42/month annual or $50/month monthly, 5 members. Jira, Asana, Linear and similar integrations only on Premium and above — [FasterFixes (vendor-written)](https://www.faster-fixes.com/blog/marker-io-alternatives); [marklayer (vendor-written)](http://marklayer.app/guides/website-feedback-tools)
- **Userback:** Team $29/month annual or $39/month monthly, 5 seats. Free plan has 2 seats and 7-day feedback retention. Moved to per-seat pricing — [framekit (3rd-party)](https://framekit.ai/blog/best-website-feedback-tools-2026); [reviseflow (vendor-written)](https://reviseflow.io/blog/best-website-feedback-tools)
- **Ruttl:** free tier; Pro $18/user/month — [Lyssna blog (vendor-written)](https://www.lyssna.com/blog/best-website-feedback-tools/); [theodorehq (3rd-party)](https://www.theodorehq.com/docket/blog/posts/best-website-feedback-widgets)
- **Pastel:** about $29/month annual; free plan with 1 canvas — [reviseflow (vendor-written)](https://reviseflow.io/blog/best-website-feedback-tools)

### Inferences
- For agencies, ourhunch's $2/site/month versus BugHerd's $42+/month or Marker.io's $39+/month is a strong headline, especially because pricing is per site, not per seat (clients and reviewers are free). Missing integrations (Jira, Linear, Asana, Slack), screenshots with console/browser metadata, and two-way sync are what these tools sell on, so they are likely ourhunch's main feature gaps against this set.

### Gaps
- Pastel and Ruttl prices come from passing mentions only; no official pages were fetched.

## 6. AI-native entrants (2025–2026): AI-moderated interviews and synthetic users

### Takeaway
Venture money has gone into AI-moderated interviews with real humans: Listen Labs (~$96–100M total, >$500M valuation), Outset ($51M), Conveo ($50M reported) and Strella ($18M). These are aimed at enterprise and CX teams, not freelancers. Synthetic users (fully AI respondents) face credibility criticism. Neither group is a direct competitor to a $2/site live-site tool, but they shape buyer expectations for AI analysis.

### Cited Findings
- **Listen Labs:** $69M Series B led by Ribbit Capital in Jan 2026 at a >$500M valuation, about $96M in total funding — [Contrary Research](https://research.contrary.com/company/listen-labs)
- **Outset:** $51M total, including a $30M Series B in Dec 2025, enterprise CX focus. Offers "digital twins" built from AI-moderated interviews — [Qualitati (3rd-party)](https://qualitati.com/blog/outset-ai-alternatives-2026); [Koji (vendor-written)](https://www.koji.so/blog/listen-labs-vs-outset-2026)
- **Strella:** $18M total, including a $14M Series A led by Bessemer in Oct 2025; customers include Amazon, Duolingo and Chobani. Vendor claims participants are more honest with an AI moderator — [Koji (vendor-written)](https://www.koji.so/blog/listen-labs-vs-strella-2026)
- **Conveo:** reportedly raised $50M from DST Global for AI customer interviews — [ai2.work (3rd-party)](https://ai2.work/blog/conveo-lands-50m-from-dst-global-for-ai-customer-interviews)
- **Incumbents adding AI moderation:** Maze offers AI-moderated interviews as an Enterprise add-on — [Maze pricing](https://maze.co/pricing/). Lyssna includes AI follow-up questions and summaries on Growth — [Lyssna pricing](https://www.lyssna.com/pricing/)
- **Synthetic-user criticism:**
  - Uncalibrated synthetic personas were rated useful by only 31% of users.
  - Synthetic users "tend to validate assumptions rather than surface genuine insights".
  - Many tools marketed as "synthetic" actually interview real humans with an AI moderator.
  - [theairankings (3rd-party)](https://theairankings.com/best-ai-synthetic-research/); [getminds (vendor-written)](https://getminds.ai/blog/ai-customer-interviews)
- **Microsoft Clarity:** reportedly added AI-agent task simulations ("where an agent gets stuck") — secondary source, unconfirmed — [ppc.land](https://ppc.land/microsoft-adds-copilot-to-clarity-analytics/)

### Inferences
- The low end has no AI-moderated, live-site usability tool at freelancer prices. A light "AI summary of task results and comments" (one paragraph plus top issues) is the cheapest way for ourhunch to meet the expectation these entrants set. Positioning around real consenting humans on the real site is a credible counter to synthetic-user scepticism.
- Agent-visit analytics (Clarity) suggests "how do AI agents use my site" is an emerging angle relevant to AI-coding builders.

### Gaps
- No public pricing was found for Listen Labs, Outset or Strella in this pass (enterprise-sales oriented).
- No independent, peer-reviewed evaluations of AI-moderated interview quality were found.

## 7. Gaps and opportunities for a $2/site tool (synthesis)

### Takeaway
ourhunch's clearest open space is consented live-site usability tasks, plus client review comments, at a per-site micro-price. Incumbents either give away passive analytics (Clarity, PostHog, Hotjar Free) or charge $150+/month, or enterprise prices, for live-site task testing (Lyssna, Maze). The main weaknesses are no participant panel, no integrations, no AI summaries, and webcam gaze accuracy.

### Cited Findings
- **Cheapest live-website testing found:**
  - Lyssna Growth at $166/month — [Lyssna pricing](https://www.lyssna.com/pricing/)
  - Maze puts live-site testing in Enterprise only — [Maze pricing](https://maze.co/pricing/)
- **Free passive analytics:**
  - Clarity is free and unlimited — [Clarity pricing](https://clarity.microsoft.com/pricing?clang=en)
  - Hotjar/Contentsquare Free has 200k sessions but samples 5% of replays — [Contentsquare pricing](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
  - PostHog gives 5k replays/month free — [PostHog pricing](https://posthog.com/pricing.md)
- **Consent:** Clarity requires a consent signal for EEA/UK/CH visitors since 31 Oct 2025 — [Clarity blog](https://clarity.microsoft.com/blog/clarity-cookie-consent-update/)
- **Client feedback tools:** priced per team or seat at $29–$59/month — [Feedbucket](https://feedbucket.app/alternatives/marker-io-alternatives); [framekit](https://framekit.ai/blog/best-website-feedback-tools-2026)
- **Attention and eye tracking:**
  - Predictive attention from €19.99/month — [Dynamic Business](https://dynamicbusiness.com/ai-tools/expoze-visual-attention-prediction-tool.html)
  - Webcam eye tracking from about $390/month, at roughly 110 px accuracy — [anygen](https://www.anygen.io/showcase/realeye/index.html); [RealEye](https://www.realeye.io/)

### Inferences
1. **Price positioning:** at $2/site/month, ourhunch undercuts every paid competitor found. The risk is perceived quality ("too cheap to be serious"). Compare it on the landing page with Lyssna/Maze for live-site testing and BugHerd/Marker.io for client review, rather than with Clarity (free).
2. **Gaps that matter for small teams, in rough order:**
   - (a) Integrations: Slack, Linear/Jira, GitHub issues. Competitors gate these behind higher tiers, so even basic ones would be a selling point.
   - (b) An AI summary of task results and comments.
   - (c) Post-task questions (SEQ, SUS) and simple screener/consent flows.
   - (d) Shareable result reports for clients.
   - (e) Optionally, a pay-per-response panel via a partner, rather than building one.
3. **Do not chase:** full session replay, NPS/survey suites, or large-scale analytics. These are commoditised (free) and conflict with ourhunch's no-tracking stance.
4. **Privacy as a selling point:** "we only record people who agreed to take part" is a clear contrast with Clarity's and Hotjar's record-everyone model and their cookie-banner burden. The claim must stay accurate: the script still loads on every page, so ourhunch should state exactly what it does and does not collect before a visitor joins.
5. **Eye tracking:** keep it "Labs" and present it as zone-level, because webcam accuracy is about 100 px. A cheap predictive-attention map with no participants is a possible add-on to compete with Expoze and Attention Insight.
6. **AI-coding builders:** no competitor targets this group explicitly. Clarity's AI-agent analytics hints at an adjacent "agent usability" angle worth watching.

### Gaps
- No direct competitor was found that combines consented live-site tasks, heatmaps, eye tracking and client review comments in one script at a micro-price. This is an absence of evidence within a limited search, not proof that none exists. Smaller indie tools (Product Hunt launches in 2025–26) were not systematically scanned.
- Review sentiment (G2/Capterra) was only sampled for Hotjar, Clarity and Maze.
