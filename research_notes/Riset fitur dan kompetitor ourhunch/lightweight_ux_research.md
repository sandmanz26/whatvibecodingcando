# Lightweight user research on live websites: how small teams, solo founders, freelancers and small agencies do it (or skip it)

Scope note: the target was observed behaviour, ideally Reddit, HN and Indie Hackers posts with verbatim quotes. The search index returned almost no Reddit threads, and Indie Hackers, G2 and one review site blocked fetching (HTTP 403/429). So most evidence below comes from industry surveys (Maze 2026, User Interviews 2025), review-site snippets, academic papers and vendor blogs. Vendor claims are labelled. Quotes marked "(snippet)" come from search-result excerpts of the cited page; I could not open the full page to check context.

## 1. Do small teams run usability tests at all, and what blocks them?

### Takeaway
Research is spreading to non-researchers: PMs, marketers and founders now run it with templates and tools. In the most recent survey, recruiting, not money, is the main blocker: finding qualified participants, time to recruit and participant quality. Small teams fall back on their own network, existing customers, Reddit and "3–5 users" guerrilla tests. Friends-and-family samples are knowingly unrepresentative.

### Cited Findings
- **Who runs research now.** In Maze's 2026 report (~500 researchers, designers and product people, published Mar 2026), PMs run research at 39% of organisations, market researchers at 35%, marketers at 23%. — [Maze, Future of User Research 2026](https://maze.co/blog/future-user-research-2026/)
- **Demand is rising.** 66% report increased demand for research, up from 55% the year before. Maze headlines this as demand "up 20%"; the calculation is not shown. — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **What non-researchers get.** Support given to non-researchers: tools and templates 61%, research repositories 49%, training 46%, specialist support 45%; 13% get nothing. — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **Survey sample.** User Interviews State of User Research 2025: n=485, fielded Jul 25–Aug 9, 2025. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Top recruiting challenges:** finding qualified participants, time to recruit, participant quality. Time to recruit is cited by 54% (down 7 points); cost concerns by only 23% (down 9 points). — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Companies with zero dedicated researchers:** 19% (2019), 6% (2022), ~14% (2025). About half of the teams surveyed were under five years old. 21% of respondents' companies laid off UX researchers in 2025. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Low study volume.** Median output over six months: 2 mixed-methods, 3 qualitative, 1 quantitative study. This is for professional researchers; small teams will be lower. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Impact rarely measured.** 54% do not track research impact numerically; only 21% of those who track it are satisfied. 59% track impact in spreadsheets or documents. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Free recruiting channels used by solo founders:** their own user base or waitlist, LinkedIn, niche Slack communities, relevant subreddits. Source is a vendor blog. — [CleverX, free tools for solo founders](https://cleverx.com/blog/free-user-research-tools-for-solo-founders)
- **Reddit as a tester source.** A Product Hunt maker: "got 52 users in first 7 days of launch as we simply asked folks to try it on Reddit who were facing same problem" (snippet). — [Product Hunt discussion](https://www.producthunt.com/discussions/how-are-you-getting-testers-for-your-product)
- **Small-sample practice.** The common heuristic is that "3–5 participants can uncover the majority of critical usability problems." Tests are run free via a meeting invite plus a prototype link. — [BYU UX4DH guide](https://ux4dh.byu.edu/how-to-test-prototypes/)
- **Representativeness is knowingly sacrificed.** Small teams "recruit through informal channels (friends and family) and may not have the luxury of having a real diverse group" (snippet). — [Lyssna, usability testing on a budget (Jul 2024)](https://www.lyssna.com/blog/usability-testing-on-a-budget/)
- **Paid micro-budget alternative:** a usability study run via Fiverr for about $375. Older post, date unclear. — [Fiverr blog](https://blog.fiverr.com/post/running-usability-testing-for-under-500-using-fiverr)
- **Panel quality complaints.** A Lyssna G2 reviewer: "the panel quality is a bit inconsistent" (snippet). Another: pricing is "wildly unpredictable" (snippet). — [G2 Lyssna](https://g2.com/products/lyssna/pricing); [G2 UsabilityHub/Lyssna reviews](https://www.g2.com/products/usability-hub/reviews)
- **Professional testers skew panels.** A vendor blog summarising Reddit discussions says panel users switch away from UserTesting partly over "semi-professional testers skewing results." Second-hand, vendor source. — [Listen Labs](https://listenlabs.com/articles/best-usertesting-alternatives/)

### Inferences
- Recruiting is the binding constraint, and cost concerns are falling. A tool that tests a team's own real visitors and customers on the live site removes the panel-quality and recruiting problem. This is the strongest wedge for a "one script tag runs tests with consenting visitors" product. The trade-off is that tiny sites have tiny traffic, so tasks need to reach the few visitors there are: share links, consent prompts, inviting existing customers.
- Non-researchers (PMs, marketers, founders) need templates and "what to test" guidance more than method flexibility. Maze shows templates are the top enablement resource (61%).
- Impact tracking is weak everywhere, so a shareable, client-ready result page (success rate, time, top issues) is a selling point for agencies.

### Gaps
- No direct Reddit or Indie Hackers verbatim quotes were retrievable. The Indie Hackers threads returned 403 and the search index surfaced no Reddit threads, so founder-level frequency (how many small teams never test) is unquantified.
- No 2024–2026 survey breaks out solo/micro-company research behaviour specifically. Both major surveys sample research professionals, which biases them toward larger organisations.
- No good data on incentive amounts that small teams pay, or on consent/GDPR as a blocker to testing (as opposed to analytics).

## 2. Heatmaps and session replay (Hotjar, Microsoft Clarity, PostHog): useful vs noise

### Takeaway
Clarity's free, unlimited heatmaps and replay have made basic behaviour analytics a commodity, and Hotjar is increasingly seen as expensive for small businesses. The recurring pains:
- **No "so what":** turning recordings into decisions is hard, and most unfiltered sessions show nothing.
- **Analysis time.**
- **Missing "why":** surveys are still needed alongside the replays.
- **Reliability:** overlays, popups and recordings that fail.
- **Privacy and legal exposure:** replay scripts capture page content, and US wiretap lawsuits have targeted them.

### Cited Findings
- **Clarity is the free baseline.** It is described as a strong free option with heatmaps, recordings, AI insights and no traffic limits; Hotjar is broader (surveys, feedback, interviews, funnels). Vendor comparison. — [Crazy Egg](https://www.crazyegg.com/blog/microsoft-clarity-vs-hotjar/); [Plerdy](https://www.plerdy.com/microsoft-clarity-vs-hotjar/)
- **Retention claims conflict.** Hotjar's own blog says Clarity stores playback data for only 30 days; G2 reviewers praise Clarity for keeping recordings longer. — [Hotjar blog](https://hotjar.com/blog/hotjar-vs-microsoft-clarity); [G2 compare](https://www.g2.com/compare/hotjar-vs-microsoft-microsoft-clarity)
- **Recording reliability.** A competitor claims "session recording reliability is a documented issue," citing GitHub reports of recordings that don't save, sessions that don't render, and EU tracking gaps. Unverified competitor claim. — [PostHog, Clarity alternatives](https://posthog.com/blog/best-microsoft-clarity-alternatives)
- **No "so what".** "Many users find it challenging to turn these observations into actionable changes without additional analysis" (snippet). — [Lucky Orange comparison (vendor)](https://www.luckyorange.com/comparisons/hotjar-vs-microsoft-clarity)
- **Low signal in raw replays.** "Watching sessions takes time, and the signal-to-noise ratio on unfiltered recordings is low. Most sessions won't show you anything useful" (snippet). Vendor. — [Zoho PageSense](https://www.zoho.com/pagesense/conversion-playbook/heatmaps-vs-session-recordings.html)
- **Replay shows struggle, not cause.** "Replay shows the struggle, but the why still needs a survey, an interview, or an experiment" (snippet). An r/PPC user is quoted saying Hotjar's surveys were the one thing Clarity didn't replace. Second-hand via a review site. — [UXcrush Hotjar review 2026](https://uxcrush.com/hotjar-review)
- **Clients push back on scripts.** A Capterra Hotjar reviewer: "a lot of clients don't want the intrusion to distract their site's users on a regular basis" (snippet). — [Capterra Hotjar reviews](https://capterra.com/p/163516/Hotjar/reviews/)
- **Cost.** Hotjar is called "relatively expensive for small businesses." One vendor page claims price rises of 800%+ since the Contentsquare acquisition (unverified single-vendor claim). — [Capterra Hotjar](https://capterra.com/p/163516/Hotjar/reviews/); [TryOrBye](https://www.tryorbye.com/products/hotjar)
- **Heatmap accuracy.** Users report heatmap inconsistencies, and popups, modals and overlays are problematic for heatmaps. — [Capterra Hotjar](https://capterra.com/p/163516/Hotjar/reviews/)
- **Misreading heatmaps.** High clicks don't mean success. One case had a team redesign a button when the real problem was a broken script. Vendor blogs (Zigpoll includes an unverifiable "NN/g 2023" stat, so I excluded it). — [Growth-onomics](https://growth-onomics.com/7-heatmap-analysis-mistakes-to-avoid/); [Zigpoll](https://www.zigpoll.com/content/top-6-heatmap-session-recording-analysis-tips-senior)
- **Privacy research.** Replay scripts capture rendered page content as well as inputs, so thorough redaction is effectively required. Princeton research (2017, older) plus a 2023 follow-up on Hotjar data exfiltration. — [Princeton CITP](https://blog.citp.princeton.edu/?p=13233); [arXiv 2309.11253](https://arxiv.org/abs/2309.11253)
- **Legal exposure.** US plaintiffs argue replay software is wiretapping without consent; courts are mixed and many complaints are dismissed early. — [Loeb & Loeb, Jul 2025](https://www.loeb.com/en/insights/publications/2025/07/understanding-session-replay-legal-risks-and-how-to-mitigate-them); [Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/privacy-litigation-trend-the-latest-on-session-replay-lawsuits-and-practical-considerations-for-risk-mitigation.md)
- **Defaults are moving to opt-in.** Vendors advise disclosing replay in the privacy policy (Heap). Grafana ships replay off by default. — [Heap](https://heap.io/blog/protecting-user-privacy-when-using-session-replay); [Grafana docs](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/session-replay/data-privacy.md)

### Inferences
- Competing with Clarity on passive heatmaps or replay at any price is weak: it is free and unlimited.
- The gap is task-based, consented, interpretable evidence: "4/5 completed the checkout task, median 48s, here's where they failed", plus the "why" from comments and voice notes. That is exactly what passive replay lacks.
- Consent-based participation also sidesteps the wiretap and replay privacy debate. That is a marketing point worth stating plainly, but without legal claims.
- Click heatmaps inside ourhunch are best positioned as task-scoped (where participants clicked during task X), not sitewide analytics.

### Gaps
- No reliable source quantified SPA or performance complaints for Hotjar or Clarity in 2024–2026. The G2 review pages could not be fetched.
- No PostHog-specific user complaints were found.
- I did not find the NN/g position on heatmap or replay analysis.

## 3. Demand for micro-surveys/NPS, end-user feedback widgets, first-click, preference, tree tests, card sorting, A/B tests, AI summaries

### Takeaway
AI in research is now mainstream: 69–80% of research pros use it, mostly for analysis and transcription. Accuracy worries are high, though: 91% worry about hallucinations. Comfort with lightweight quantitative methods (first-click, tree test, card sort) rose sharply in 2025. Targeted on-site micro-surveys get real response rates (roughly 8–30% depending on format and vendor), and the "why" gap left by replay tools keeps surveys in demand.

### Cited Findings
- **AI use (Maze).** 69% use AI in at least some research projects (+19% YoY). Reported benefits: faster turnaround 63%, efficiency 60%. — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **What respondents keep human.** Interpreting nuance and emotion 82%, framing questions 76%, stakeholder storytelling 64%. — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **Earlier Maze figures (fielded Dec 2024–Jan 2025, n=800+):** 58% used AI. Top uses: analysing research data 74%, transcription 58%. — [Maze 2025 report](https://maze.co/resources/user-research-report-2025/); [Maze 2025 trends](https://maze.co/blog/future-user-research/)
- **AI use and sentiment (User Interviews).** 80% use AI (+24 points), but sentiment is 41% negative vs 32% positive. 91% worry about accuracy and hallucinations; 63% fear AI devalues human insight. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Comfort with lightweight methods in 2025:** first-click testing 84% (+12), card sorting 84% (+6), tree testing 81% (+9), co-design 85% (+13). Concept testing use is at 64% (+6). — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **In-app NPS response rates.** 21.71% across 283 surveys; web apps 26.48%, mobile 36.14%. Vendor data, but the largest sample found. — [Refiner 2025](https://refiner.io/blog/in-app-survey-response-rates/)
- **On-site survey response rates by format.** Targeted popups 15–30%, side-tab widgets 2–4% (Zonka); popups 8–15% (another vendor); 15–25% (Wisepops). All vendor figures, and they conflict. — [Zonka](https://www.zonkafeedback.com/blog/feedback-widgets); [Qualaroo](https://qualaroo.com/blog/nps-survey-response-rate/); [Wisepops](https://wisepops.com/use-cases/survey-popups)
- **Fatigue controls are standard advice:** stop after 3 dismissals; once per visitor per 30 days; each added question costs roughly 15–20% of responses (vendor estimate). — [Zonka NPS](https://www.zonkafeedback.com/blog/nps-survey-response-rates); [Wisepops](https://wisepops.com/use-cases/survey-popups)
- **Widget vs survey.** A widget vendor argues small teams benefit more from an always-on feedback widget than surveys, because it needs no sample-size math and yields concrete requests. Vendor opinion. — [Feeqd](https://feeqd.com/blog/feedback-widget-vs-survey)

### Inferences
- An AI summary of comments, voice notes and task results is now table stakes. It should show sources (link each claim back to the comment or recording) to address the 91% accuracy worry. "Auto-insights" without traceability will be distrusted by practitioners.
- First-click and 5-second/preference tests are lightweight and increasingly familiar, which supports keeping them.
- Tree testing and card sorting are IA methods that don't need a live site. They are lower priority for a live-site script product.
- A one-question post-task survey (SEQ/ease rating) or micro-survey is a cheap, high-value addition that fills the "why" gap noted for Clarity.

### Gaps
- No credible data on small-team demand for feature-request boards or A/B testing specifically.
- No independent (non-vendor) benchmark of on-site survey response rates.

## 4. Webcam/AI eye tracking and predictive attention heatmaps: accuracy, value, trust

### Takeaway
Webcam eye tracking yields usable, coarse data, roughly 2–5° error, good for large areas of interest and not for fine targets. It suffers high drop-off: one study recommends over-recruiting by 150%. Participants accept it reasonably well. Predictive "AI attention" heatmaps advertise 90–96% accuracy, but that is vendor-measured. Independent commentary frames them as a "spell checker" for early design that cannot capture task-driven or expert behaviour. "Labs" labelling is appropriate.

### Cited Findings
- **Remote webcam study (2022, n=52).** Usable eye-tracking data can be obtained with ordinary webcams remotely, but drop-off is high: recommend over-recruiting by 150%. "The acceptance of the approach by the study participants is high despite the given limitations." — [Lim et al., arXiv 2207.14380 (2022)](https://arxiv.org/abs/2207.14380)
- **iMotions WebET 3.0 validation (2023, vendor):** >50% of participants at ≤2° of visual angle accuracy, >90% at ≤5°. Older webcam work reported 3–5° error. — [iMotions validation PDF](https://imotions.com/wp-content/uploads/2025/03/iMotions-WebET-3.0-Validation-Study-june-2023.pdf)
- **Webcam vs infrared comparison (2014, cited later).** High accuracy (81–100%) only with large targets; "not suitable for tasks that need fine precision." — [CMS conference paper](https://openaccess-api.cms-conferences.org/articles/download/978-1-7923-8988-7_123)
- **WebGazer thesis.** Webcam tracking is viable "in cases where very accurate data quality is not required." — [Utrecht thesis](https://studenttheses.uu.nl/bitstream/handle/20.500.12932/40709/Eindwerkstuk_Bachelor_KI_Mark_Wessel_6008283_final.pdf?sequence=1)
- **Predictive heatmap accuracy (vendor claims):** Attention Insight claims up to 96% accuracy "without human participants" and 92.5% against MIT benchmarks; Expoze claims ~94%. — [Attention Insight](https://www.attentioninsight.com/technology); [Expoze (Chrome store)](https://chrome.google.com/webstore/detail/expozeio/hadeipehdgpogkgkhlmfdaganknpphjb/support)
- **Tobii (sells real eye trackers, so interested party).** Saliency models predict "average" attention well, but depend on training data matching your audience and cannot capture expert vs novice differences. — [Tobii blog](https://www.tobii.com/blog/ai-actual-intelligence)
- **UXBooth.** The predictive method's accuracy "is currently lower than that of participant-based eye tracking studies." Its value is speed. — [UXBooth](https://uxbooth.com/?p=44879)
- **Paul Boag.** Calls attention simulation not perfect but useful, "like a spell checker for designers." — [Frontend Masters course](https://frontendmasters.com/teachers/paul-boag/user-tests-eye-tracking-simulation/)
- **Olsen (2026).** Argues these tools prioritise efficiency over representational accuracy and reinforce existing assumptions. — [Olsen, "The algorithmic gaze"](https://repository.uwl.ac.uk/id/eprint/14769/11/OlsenD_The%20algorithmic%20gaze_VoR_PDFA.pdf)

### Inferences
- Webcam eye tracking is a differentiator for demos and marketing, but should stay "Labs".
- Report gaze at the area-of-interest level (did they look at the price/CTA region) rather than precise fixation maps.
- Warn about calibration and drop-off, and never make it a required part of a test, because drop-off would kill small-traffic studies.
- Privacy messaging ("video never leaves the browser") matters for participant consent.
- Predictive heatmaps are a cheap competitor to the "where do people look" job. Real-participant gaze is the honest counter-position, but only if accuracy caveats are shown.

### Gaps
- No independent 2024–2026 study validating Attention Insight, Neurons or Expoze.
- No survey on how much designers trust these tools.
- No data on what share of website participants will grant webcam access in unmoderated live-site tests.

## 5. Unmoderated testing on live sites vs prototypes; participant experience; mobile

### Takeaway
I found little direct 2024–2026 evidence. The available signals:
- Testing with real users and existing customers is recommended as the budget route.
- Clients dislike intrusive scripts on their sites.
- Webcam methods add drop-off.

### Cited Findings
- **Existing customers are a main recruiting source for budget testing.** — [Lyssna on a budget (2024)](https://www.lyssna.com/blog/usability-testing-on-a-budget/)
- **Clients object to intrusive on-site prompts.** (snippet) — [Capterra Hotjar](https://capterra.com/p/163516/Hotjar/reviews/)
- **Popups and overlays break heatmap data.** — [Capterra Hotjar](https://capterra.com/p/163516/Hotjar/reviews/)
- **Over-recruit by 150% for webcam-based remote tests.** — [arXiv 2207.14380](https://arxiv.org/abs/2207.14380)

### Inferences
- A no-install, no-account participant flow on the real site (consent prompt, then task) is a meaningful UX advantage over extension- or app-based testers, but it is not proven by the sources here.
- Mobile support should be explicit: mobile in-app survey response is the highest channel (36% per Refiner).

### Gaps
- No sources found on participant friction from browser extensions or accounts (e.g., UserTesting or Maze participant complaints).
- No sources on live-site vs Figma prototype testing preference among small teams.
- No mobile unmoderated testing data. Reddit and G2 were not retrievable for these.

## 6. What makes small teams act on research

### Takeaway
Impact is mostly tracked informally:
- Practitioners see storytelling and stakeholder influence as human work.
- Research influence on strategy is growing.
- Few teams quantify outcomes.

Shareable, concise evidence is what moves stakeholders and clients.

### Cited Findings
- **Research seen as essential to all levels of strategy:** 8% (2025) → 22% (2026). — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **Storytelling stays human.** 64% say influencing stakeholders through storytelling is where humans matter most. — [Maze 2026](https://maze.co/blog/future-user-research-2026/)
- **How impact is judged.** 83% measure impact qualitatively: observing how findings are used 85%, follow-up conversations 80%. Of those tracking numbers, 57% use customer metrics like NPS. 71% experimented with new ways of sharing insights. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)
- **Prioritisation is driven by question type (87%) and timeline/speed (74%);** 52% say ROI expectations don't influence priorities. — [User Interviews 2025](https://www.userinterviews.com/state-of-user-research-2025-report)

### Inferences
- For agencies and freelancers, a read-only share link with a short results summary is likely the feature that gets research acted on and paid for. The summary would cover task success, time, top issues with clips or comments, and an AI summary with sources. This connects to the existing ourhunch share-link pattern.
- Speed matters (74% prioritise by timeline). Same-day setup and results should be the core promise.

### Gaps
- No direct evidence from freelancers or agencies on whether clients pay for research add-ons, or how they present heatmaps and test results to clients. The targeted searches returned only vendor pages.
