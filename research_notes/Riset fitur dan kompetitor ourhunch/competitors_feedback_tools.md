# Competitor landscape: website visual feedback, client review and bug reporting tools (as of Nov 2026)

Research date: 2026-11-23. Prices were read from vendors' live pricing pages on that date unless marked otherwise. "Annual" means the per-month price when billed yearly. G2 and Capterra pages blocked direct fetching (HTTP 403), so ratings come from search snippets and third-party pages and are flagged where they come from a competitor.

Context: ourhunch = one script tag; pinned comments on page elements; voice notes; reviewers via a one-time link with no account; comments carry page/element/device; CSV export; "copy as AI fix prompt"; built-in user tests and heatmaps. Free (1 site), Pro $2 per site per month. Targets freelancers, small agencies, AI-coding builders.

## 1. Established client-feedback / bug-reporting tools: features, access, integrations, AI, pricing

### Takeaway
The established players (Marker.io, BugHerd, Userback, Feedbucket, Usersnap, Pastel, Ruttl, zipBoard, Filestage, MarkUp) all offer unlimited free guests/reviewers, and nearly all now include an MCP server for AI coding agents. Entry prices for teams cluster at $39–$59/month (annual vs monthly), and the features agencies care most about (console logs, session replay, Jira/Asana/ClickUp, white-label, CSV export) are kept for tiers from about $89 to $199/month.

### Cited Findings

**Marker.io** (agency / dev-team bug reporting; widget plus browser extension)
- Starter $39/mo annual or $59/mo monthly: 3 members, up to 10 projects. Team $149/mo annual or $199/mo monthly: 15 members, up to 50 projects. Agency $99/mo annual or $129/mo monthly: 15 members, 50 active client projects ("eligible agencies, conditions apply"). Business: custom pricing. Extra members cost $4–$9/mo. — [Marker.io pricing](https://marker.io/pricing)
- Guests/reporters are unlimited and free on every plan. Session replay and console/network logs are on Team and above only (not Starter). Jira is on Team and above. Azure DevOps, Zendesk and Intercom are Business only. Trello, Asana, ClickUp, GitHub, GitLab, Linear and Notion are on all plans. — [Marker.io pricing](https://marker.io/pricing)
- Custom branding (the widget matches your brand) and CSV export are on Team/Business only. No white-label is mentioned. SSO, audit logs and data masking are Business only. 15-day free trial, no card, no free plan. — [Marker.io pricing](https://marker.io/pricing)
- AI: AI translation, "Magic Rewrite", title generation and the **Marker.io MCP** are on all plans. The MCP lets agents such as Claude or Codex read feedback and scan results and fix issues in code or a CMS. Marker.io has added site **monitoring** (10 monitored pages, weekly WCAG/content scans; +$39/mo for more pages; "custom AI checks" coming soon). — [Marker.io pricing](https://marker.io/pricing)
- G2: 4.8/5 from 40 reviews (on G2's comparison page). — [G2 compare](https://www.g2.com/compare/bugherd-vs-marker-io)
- Criticism from a BugHerd-written (biased) comparison: less friendly for non-technical clients, and full features need the browser extension installed. Another review says it covers live web pages only, with no PDF or image review. — [G2 alternatives / search summary](https://www.g2.com/products/marker-io/competitors/alternatives); [toolradar](https://toolradar.com/tools/marker-io)

**BugHerd** (agency client feedback; script plus extension, task board)
- Standard $42/mo annual ($500/yr) or $50/mo monthly: 5 members, 10 GB. Studio $67/mo annual or $80/mo monthly: 10 members, 25 GB. Premium $125/mo annual or $150/mo monthly: 25 members, 50 GB. Enterprise: custom. Unlimited guests and projects on every plan. Extra members $8/mo (the page also shows conflicting annual figures). — [BugHerd pricing](https://bugherd.com/pricing)
- No free plan. A free trial (length not stated) and a 60-day money-back guarantee. — [BugHerd pricing](https://bugherd.com/pricing)
- All plans: screenshots and technical data, annotation, Figma/PDF/image feedback, suggested text edits, video feedback, public feedback widget. **White-label (custom logo), guests seeing other guests' feedback, guest task board and feedback deadlines are Premium only.** — [BugHerd pricing](https://bugherd.com/pricing)
- Integrations: Trello, Slack, MS Teams, GitHub, Zapier, Make, WordPress and others from Standard. **Jira, Linear, Asana, ClickUp, Monday and Teamwork are Premium ($125–$150/mo) only.** — [BugHerd pricing](https://bugherd.com/pricing)
- AI: MCP (Beta) and auto-titles on all plans. Auto-tagging and similar-task detection are Premium only. BugHerd MCP connects Claude and Cursor to projects, tasks and client feedback, "free for all users" (beta). — [BugHerd pricing](https://bugherd.com/pricing); [BugHerd MCP](https://bugherd.com/feature/mcp)
- No explicit approval/sign-off workflow is listed. — [BugHerd pricing](https://bugherd.com/pricing)
- G2: 4.7 from about 225 reviews (G2 review page); 203 reviews on another G2 page. Praised for ease of use. Complaint (from a competitor's blog): per-member pricing gets expensive as teams grow, and clients need some guidance on their first visit. — [G2 BugHerd reviews](https://www.g2.com/products/bugherd/reviews); [G2 alternatives](https://www.g2.com/products/bugherd/competitors/alternatives)

**Userback** (feedback + bug reporting + product feedback; widget, extension, SDKs)
- Free Forever $0: 2 sites, 2 seats, **feedback available for only 7 days**. Team $39/mo annual or $49/mo monthly: 5 sites, 5 seats. Business $89/mo annual or $119/mo monthly: 25 sites, 15 seats. Business Plus $159/mo annual or $199/mo monthly: 50 sites, 25 seats. Enterprise: custom. Unlimited feedback on every plan. — [Userback pricing](https://userback.io/pricing/)
- **MCP is on Team and above.** Session replay, console logs, network requests, custom branding, AI feedback insights, surveys and two-way Jira/ClickUp sync are Business and above. A mobile SDK, REST API, webhooks and removal of the Userback logo are Business Plus only. SSO and SOC 2 are Enterprise. — [Userback pricing](https://userback.io/pricing/); [Userback MCP docs](https://docs.userback.io/docs/userback-mcp)
- Discounts: 25% off for startups (first year) and 25% off for education and charities. — [Userback pricing](https://userback.io/pricing/)
- G2: 4.7/5 from 287 reviews. Complaint (competitor-written): more features than small teams need, and API access only on the top tier. — [G2 alternatives](https://www.g2.com/products/marker-io/competitors/alternatives); [simplecommenter (biased)](https://www.simplecommenter.com/alternatives/userback-alternatives)

**Feedbucket** (agency website feedback; script widget)
- Pro $49/mo monthly: 2 members. Business $89/mo monthly: 25 members. Enterprise: custom. Unlimited projects, feedback and client reporters on every plan. A yearly toggle says "Save 20%", but no annual figures are shown. — [Feedbucket pricing](https://www.feedbucket.app/pricing)
- Video feedback on all plans. Console logs, custom metadata, **white-label (own logo, remove "Powered by")**, CSV export, the JS API and webhooks are Business only. All integrations (Asana, Jira, Slack, GitHub…) and an MCP connector are on all plans. 14-day trial, no free plan. — [Feedbucket pricing](https://www.feedbucket.app/pricing)
- Feedbucket claims a 5.0 Capterra rating from 37 reviews (its own marketing, unverified). — [search summary of Feedbucket blog](https://feedbucket.app/blog/website-feedback-tool)

**Usersnap** (product feedback / VoC more than agency review)
- Starter €49/mo: 2 seats, 2 projects. Growth €129/mo: unlimited seats, 10 projects. Professional €219/mo: 20 projects. Premium €459/mo: 50 projects. Enterprise: custom. Only monthly euro prices are shown; yearly "save up to 3 months". — [Usersnap pricing](https://usersnap.com/pricing)
- Screen/audio recording and console logs on all plans. Custom branding and webhooks are Premium/Enterprise only. MCP on all plans (2–5 projects). AI classification and root-cause analysis are add-ons below Professional; AI triage is Premium+. No free plan; the trial is a free month of Premium earned after setting up 2 channels and collecting 20 feedback items. — [Usersnap pricing](https://usersnap.com/pricing)
- Rating: 4.5 from 93 reviews (cited by competitor Feedbucket). Praised for detailed context in reports and its Jira, Zendesk, Slack and Trello integrations. Complaints: price for small companies, and branding removal and the API only on higher plans. — [search summary of Feedbucket and doboard comparisons](https://www.doboard.com/blog/best-website-feedback-tools/)

**Pastel** (design/website review canvases for agencies; proxy-style "canvas" by URL)
- Free $0: 1 user, 1 active canvas. Pro $29/mo annual ($350/yr) or $35/mo monthly: 2 users, 3 canvases, 100 GB video. Team $99/mo annual ($1,190/yr) or $119/mo monthly: from 5 users (+$24 per user), unlimited canvases. Enterprise $450/mo, billed yearly ($5,400). — [Pastel plans](https://usepastel.com/plans)
- Unlimited reviewers, comments and views on every plan. Guests need no login. **Approvals, feedback deadlines, pausing comments, CSV export and a responsive tester are included even on Free.** PM integrations (Trello, Asana, Jira, ClickUp, Monday, Zapier) and webhook export are Team only. White-label is not mentioned. — [Pastel plans](https://usepastel.com/plans); [Pastel home](https://usepastel.com/)
- "Pastel for AI agents": MCP server or CLI. The agent uploads what it built with one command, reviewers comment with no account, the agent triages or acts on the feedback and uploads a new version. Plan availability is not stated. — [Pastel agents](https://usepastel.com/agents)
- Rating: 4.5 from 43 reviews (cited by competitor Feedbucket). Many Capterra reviews date from 2019–2021. — [Capterra Pastel reviews](https://www.capterra.com/p/176456/Pastel/reviews/)

**Ruttl** (website, mobile app, image and PDF feedback; India-based, low price)
- Basic: free, up to 5 users, 1 project, 5 pages, **10 comments**. Pro $18 per user per month: 1 admin + up to 50 users, unlimited projects and comments, 15 device sizes, versioning. Business: custom (SAML). Unlimited guests on all plans. Annual prices are not displayed. — [Ruttl pricing](https://ruttl.com/pricing/)
- Integrations: Slack, Trello, Asana and Jira on Free; ClickUp on paid plans. Custom domain and brand colours are mentioned in an enterprise callout. AI features are not listed. — [Ruttl pricing](https://ruttl.com/pricing/)
- Capterra (UK): 4.4 from 42 reviews. Easy for non-technical clients and good value; some reviewers report bugs and poor support. — [Capterra UK Ruttl](https://www.capterra.co.uk/software/202384/ruttl)

**zipBoard** (website, PDF, video and asset review for agencies and e-learning)
- Team from $99/mo: up to 20 asset pieces, 1 GB, unlimited projects, unlimited collaborators and reviewers. Agency from $199/mo: 50 uploads, integrations, reports. Enterprise: custom (SSO, custom domain, custom workflows). Annual prices not shown. 14-day trial, no free plan. — [zipBoard pricing](https://zipboard.co/pricing)

**Filestage** (formal content approval: video, PDFs, images, and live websites as a file type)
- Free $0: 1 active project, 5 new files a month, 10 seats. Starter and Business show **conflicting prices on the same page** ($199 or $249/mo, and $329 or $399/mo). Yearly billing gives "2 months free". Enterprise: custom. — [Filestage pricing](https://filestage.io/pricing/)
- Unlimited reviewers with no account needed. Strongest approval workflow in the set: approve / request changes, due dates, reminders, version compare, review checklists, and "verified approval" (e-signature style) on Enterprise. Custom logo from Starter. Jira, Zapier and Monday from Business. AI "Review Agents" (compliance, grammar, forbidden terms; 50 credits a month) on Business and Enterprise. — [Filestage pricing](https://filestage.io/pricing/)

**MarkUp.io** (multi-format review)
- Built by **Ceros** ("built by Ceros, the team behind interactive content…"; footer says MarkUp Inc.). I found no 2025–2026 acquisition news; it appears to have been a Ceros product for some time. — [MarkUp.io](https://www.markup.io/); [Ceros newsroom](https://www.ceros.com/newsroom/ceros-acquires-online-visual-commenting-tool-oroson/)
- Comments on 30+ file types including websites; guests review with no registration; Chrome extension; unlimited collaborators. No AI features mentioned; prices are not shown on the homepage. — [MarkUp.io](https://www.markup.io/)

**Webvizio** (dev-focused website feedback with AI prompts)
- Solo $8/mo: 5 projects, 2 users. Starter $28/mo: 10 projects, 5 users, guest access, unlimited video, account branding. Advanced $76/mo, shown as $45.60/mo with a limited promo code: 100 projects, 20 users. Enterprise: custom. The page does not say which billing cycle the prices are for ("Save 20%" annual). No free plan; a 7-day trial. — [Webvizio pricing](https://webvizio.com/pricing/)
- Technical logs, "retro steps" and **AI Prompts** on all plans. The feature table lists console logs, network logs, an MCP server, AI task titles and a Cursor integration, but not which plan includes each. — [Webvizio pricing](https://webvizio.com/pricing/)

**Superflow** (website review + monitoring; now usesuperflow.ai)
- Starter: free, 1 seat, 1 review project. Growth $24/seat/mo annual or $29 monthly. Scale $32/seat/mo annual or $39 monthly. Enterprise: contract. Unlimited free guests on every plan. — [Superflow pricing](https://usesuperflow.ai/pricing)
- Comments, pins, screenshots, recordings and **voice** on all plans; website, PDF, video, image and Lottie review; cross-device review. Sites are added by URL with nothing to install; logged-in pages need the extension. Read-only MCP on Free; full MCP (Claude, Cursor, Claude Code) plus "Ask AI" on Growth. White-label reports from Growth, and a white-label toolbar from Scale. Full site monitoring costs $10 per site per month beyond the sites included. — [Superflow pricing](https://usesuperflow.ai/pricing)

**Atarim** (pivoted from WordPress feedback to "AI agents for agencies")
- Free: 1 site, 200 one-time credits. Pro $67/mo monthly (annual saves 20%): up to 1,000 projects, up to 100 seats, 5,000 credits/month, six named AI "specialists", client dashboard with your brand. Enterprise: custom. Credit top-ups $10 per 1,000. — [Atarim pricing](https://atarim.io/pricing/)
- Inconsistent client limits on its own page (5 clients vs 4 vs unlimited under fair use). There is a free Atarim MCP. "Nothing reaches a client without your approval." — [Atarim pricing](https://atarim.io/pricing/)
- Rating conflict: 4.2 from 26 reviews vs "no reviews" (both claims from Feedbucket pages): unverified. — [Feedbucket alternatives](https://feedbucket.app/alternatives/pastel-alternatives)

### Inferences
- Unlimited free guests is table stakes; ourhunch's "no account" link is a must-have, not a differentiator. What sets it apart is the **one-time token / reviewers-only default** and that it is a script, not a proxy or extension.
- The "per site" price model is rare: Userback is priced by site count (2/5/25/50), but most others charge per seat or flat with project caps. At $2 per site, ourhunch is far below Webvizio Solo ($8) and Superflow Growth ($24/seat).
- Paywall pattern to exploit: console logs, PM integrations (Jira/Asana/ClickUp at BugHerd, Pastel), white-label and CSV export (Marker.io Starter, Feedbucket Pro) are held back to $89–$199/mo tiers. Freelancers who want only one of these are overcharged.
- Agency pain points (inferred from my own prior knowledge, not verified this session): Marker.io and BugHerd use a script plus extension; Pastel uses a proxy-style canvas that can break logged-in or dynamic pages, which is why Superflow requires its extension for logged-in pages.

### Gaps
- Live G2/Capterra scores could not be fetched (403). The figures above are snippets or competitor-cited and should be checked by hand.
- Feedbucket, Ruttl, Webvizio and zipBoard annual prices are not shown on their pages.
- Mobile-app (native) feedback: only Userback (mobile SDK, Business Plus) and Ruttl (mobile app feedback) were confirmed; the others were not checked.
- MarkUp.io prices were not found on its homepage.

## 2. Developer and platform alternatives: Vercel Comments, Jam.dev, Loom

### Takeaway
Vercel Comments are free but every commenter needs a Vercel account and the site must be on Vercel. Jam is a developer bug-capture extension with a strong free tier. Loom is the generic video fallback. None of the three gives non-technical clients a no-account, element-pinned review on any host.

### Cited Findings
- **Vercel Comments/Toolbar**: available on all plans, free, on by default on preview deployments, and can be used in production and on localhost via the toolbar or extension. **"The only requirement is that all users must have a Vercel account."** Threads link to Slack. Comments can be managed from the CLI. — [Vercel Comments docs](https://vercel.com/docs/comments)
- External collaborators can view without an account but must create a Vercel account to comment. Hobby users can invite only one collaborator at a time; inviting external users is on Pro/Enterprise. — [Vercel sharing docs](https://vercel.com/docs/deployments/sharing-deployments)
- **Jam.dev**: Free (5 creator seats, unlimited viewers, 30 Jams/month, 5 Recording Links/month, 5-minute recordings, 30 AI summaries) includes console and network logs, device metadata, user actions, Jira/Linear/Slack, webhooks and **MCP debugging**. Team $14 per creator per month, billed yearly (no monthly price shown): unlimited Jams, 150 Recording Links/month, backend logging. Enterprise: custom. — [Jam pricing](https://jam.dev/pricing)
- **Loom**: Starter free (25 videos per person, 5-minute recordings, 720p). Business $18 per user per month. Business + AI $24 per user per month (AI titles, summaries, tasks, "record for agents"). Enterprise: custom. Annual billing saves "up to 17%". — [Loom pricing](https://www.loom.com/pricing)

### Inferences
- Vercel is ourhunch's sharpest threat for AI-coding builders hosting on Vercel (free, built in). But the account requirement for comments is a real barrier for clients, and the tool is tied to Vercel hosting. Ourhunch can win "client on any host, no account".
- Jam's "Recording Links" (5 a month free) are the closest analogue to ourhunch's guest link, but they are aimed at bug repro by developers, not design review.
- Loom is the de facto alternative because clients already know it, but video gives no element, selector or device context and cannot be fed to an agent cleanly. "Voice note pinned to an element" is a way to win over Loom users.

### Gaps
- I did not confirm whether Loom viewers need an account to comment.
- Jam's per-tier details (instant replay, blur) were unclear on the pricing page.

## 3. AI-native and emerging entrants (2025–2026): MCP-first feedback

### Takeaway
A new cluster built for AI coding agents appeared in 2025–2026: Faster Fixes, Vynix, Agentation, Vibe Annotations and stagewise. Each of the first three sends element-level feedback to Claude Code/Cursor/Codex over MCP, and Faster Fixes and Vynix also offer no-account reviewer links. They are cheap ($7–$20/mo) and close to ourhunch's AI-builder positioning, but none of them bundles user tests or heatmaps.

### Cited Findings
- **Faster Fixes**: open-source React widget (`@fasterfixes/react`; Next.js; no plain script tag yet). Shareable link per client, no sign-up. Reports include a screenshot, URL, DOM selector and **React component tree**. Two-way GitHub/Linear sync. MCP for Cursor/Claude Code/Codex. Free: 1 project, 50 items, 1 member. Pro $20/mo: 5 projects, 5 members, white-label. Agency $99/mo: unlimited. Tracked since 2026. — [toolradar (checked Nov 20, 2026)](https://toolradar.com/tools/faster-fixes); [Product Hunt](https://www.producthunt.com/products/faster-fixes/reviews); [mcp.so](https://mcp.so/servers/faster-fixes)
- **Vynix** (founded 2026): **single script tag** or extension, under 16 KB gzipped, Shadow DOM. Read-only share link with no login, revocable and expiring. Captures CSS selector, XPath, DOM, computed styles, console errors and failed requests. **Exports as Markdown, AI prompt or JSON.** One-click GitHub issues with auto-assignment to Copilot. AI root-cause diagnosis (bring your own key). Native MCP. Free: 1 project, 50 annotations a month. Pro from $7 per seat per month. — [Vynix](https://www.vynix.in/)
- **Agentation**: open-source visual feedback toolbar (npm package) whose MCP server sends annotations to Claude Code, Codex or Gemini CLI; the agent can reply in threads and mark notes resolved. Product Hunt launch date unclear (structured data says March 26, 2026). — [Paralect](https://www.paralect.com/mcp/agentation); [Product Hunt](https://producthunt.com/products/agentation?amp=&amp=)
- **Vibe Annotations**: open-source Chrome extension for annotating **localhost** with MCP handoff (predates 2026). — [GitHub](https://github.com/RaphaelRegnier/vibe-annotations)
- **stagewise**: started (2025, YC) as an open-source browser toolbar connecting a localhost app to IDE agents. It was **rebuilt in April 2026 as its own browser environment** with an agent that reads the DOM and console. Pricing: Hobby free, Individual $20/mo, Enterprise custom. It is now a coding agent, not a client-feedback tool. — [stagewise blog Apr 8 2026](https://stagewise.io/news/the-coding-agent-built-for-the-web); [stagewise pricing](https://stagewise.io/pricing); [YC launch](https://www.ycombinator.com/launches/O3M-stagewise-the-frontend-coding-agent-for-production-codebases)
- **BugBug**: a codeless **test automation** tool, not visual feedback. Its MCP (Oct 2026) lets Claude Code, Cursor or Codex create and run tests. Prices conflict ($99/mo vs $189/mo annual PRO; free tier exists). — [BugBug pricing.md](https://bugbug.io/pricing.md); [thectoclub](https://thectoclub.com/tools/bugbug-review/)
- **Problem Picker**: no product by this name found in two searches. Closest is an open-source "element picker" feedback widget that sends issues to Linear. — [GitHub bubblesorted/feedback-widget](https://github.com/bubblesorted/feedback-widget)
- Incumbents have caught up on MCP: Marker.io (all plans), BugHerd (beta, all plans), Userback (Team+), Usersnap (all), Feedbucket (all), Superflow (read-only free, full on Growth), Webvizio (in table), Pastel (MCP/CLI), Jam (free). — sources in sections 1–2.

### Inferences
- "Copy as AI fix prompt" is **no longer unique**: Vynix exports AI prompts, Webvizio has "AI Prompts", and MCP is now nearly universal. Ourhunch needs an MCP server (or at least an agent-readable export) to stay at parity with AI builders; a copy button alone looks behind.
- Vynix is the closest direct competitor (script tag, Shadow DOM, no-login share link, AI-prompt export, $7/seat). Ourhunch's distinctive extras versus Vynix: voice notes, one-time reviewer tokens, device context, user tests/heatmaps, and per-site rather than per-seat pricing.
- The AI-native tools target developers (React-only components, localhost extensions); they have not built for non-technical clients (deadlines, approvals, plain-language UI).

### Gaps
- Feature details for Agentation and Vynix come from listings and vendor pages only; I found no independent reviews.
- "Problem Picker" could not be identified; the owner may mean a different spelling.

## 4. Gaps none of them cover well (opportunities for ourhunch)

### Takeaway
No tool combines (a) a script install with no-account, revocable one-time reviewer links, (b) MCP or agent handoff, (c) voice pinned to elements, (d) user tests or heatmaps, and (e) a free-to-$2 per-site price. Each competitor covers two or three of these at most, and agency-grade extras sit behind $89+/month tiers.

### Cited Findings
- Price floor for paid agency tools: Marker.io $39–$59, BugHerd $42–$50, Userback $39–$49, Feedbucket $49, Usersnap €49, zipBoard $99, Filestage $199+; cheapest paid: Webvizio $8, Vynix $7/seat, Faster Fixes $20, Ruttl $18/user. — [Marker.io](https://marker.io/pricing); [BugHerd](https://bugherd.com/pricing); [Userback](https://userback.io/pricing/); [Feedbucket](https://www.feedbucket.app/pricing); [Usersnap](https://usersnap.com/pricing); [zipBoard](https://zipboard.co/pricing); [Filestage](https://filestage.io/pricing/); [Webvizio](https://webvizio.com/pricing/); [Vynix](https://www.vynix.in/); [toolradar Faster Fixes](https://toolradar.com/tools/faster-fixes); [Ruttl](https://ruttl.com/pricing/)
- Free plans are crippled: Userback Free keeps feedback for only 7 days; Ruttl Free allows 10 comments; Pastel Free 1 canvas; Faster Fixes and Vynix Free 50 items; Marker.io, BugHerd, Feedbucket, zipBoard and Webvizio have no free plan. — sources as above
- Voice: only Superflow lists voice comments explicitly; Usersnap has screen + audio recording. — [Superflow](https://usesuperflow.ai/pricing); [Usersnap](https://usersnap.com/pricing)
- Behaviour research (replay, surveys) appears only in Userback Business ($89+) and Marker.io Team (session replay, $149+); none of the feedback tools offer heatmaps or moderated user tests. — [Userback](https://userback.io/pricing/); [Marker.io](https://marker.io/pricing)
- Approval/sign-off is strong only in Filestage (verified approval) and Pastel (approvals on Free); BugHerd lists none; the AI-native tools list none. — [Filestage](https://filestage.io/pricing/); [Pastel](https://usepastel.com/plans); [BugHerd](https://bugherd.com/pricing)
- Vercel requires a Vercel account for every commenter. — [Vercel docs](https://vercel.com/docs/comments)
- Incumbents are drifting up-market into monitoring and AI agents (Marker.io monitoring and AI checks, Superflow site monitoring at $10 per site, Atarim credits and "AI specialists", Usersnap VoC add-ons). — [Marker.io](https://marker.io/pricing); [Superflow](https://usesuperflow.ai/pricing); [Atarim](https://atarim.io/pricing/); [Usersnap](https://usersnap.com/pricing)

### Inferences
- **Gap 1: cheap, complete for one freelancer.** No one sells CSV export, integrations and an MCP server for one site at a few dollars. Ourhunch at $2 per site wins on price, provided it has the export and agent hooks freelancers expect.
- **Gap 2: feedback to fix loop for non-developers.** AI-native tools serve developers; agency tools serve clients but bolt on MCP. A tool where a non-technical client pins a voice note and the builder's agent receives element, device and a transcript as a fix task is not clearly owned by anyone. Recommendation: ship an MCP server plus voice transcription in the AI prompt.
- **Gap 3: review + validation in one script.** Nobody pairs client review with lightweight user tests and heatmaps. This is ourhunch's most defensible angle, but it must be positioned as "check the fix works with real users", not as a separate analytics suite (Hotjar-style competitors were outside this scope).
- **Gap 4: lightweight sign-off.** A simple "approve this page/version" with a timestamp, for freelancers billing milestones, is missing outside Filestage/Pastel.
- **Gap 5: security posture of guest links.** Most tools offer permanent share links or need accounts; one-time, revocable reviewer tokens (ourhunch) and expiring links (Vynix) are rare, a selling point for agencies on client staging sites.
- Risks: Vercel Comments (free) for Vercel-hosted AI builders; Vynix/Faster Fixes undercutting on the AI angle; per-site at $2 may signal low quality to agencies used to $50–$150/mo. Consider an agency bundle.

### Gaps
- Heatmap/user-testing competitors (Hotjar, Microsoft Clarity, Maze, Lyssna) were out of scope; the claim that "no one bundles them" covers only the feedback tools reviewed here.
- Review complaint themes are thin because G2/Capterra could not be fetched directly.
