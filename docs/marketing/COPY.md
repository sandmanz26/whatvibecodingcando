# Bank teks — siap salin

Aturan untuk semua teks:
- **Jangan klaim fitur yang belum ada** (lihat `PLAN.md` §2). Hapus baris yang belum benar sebelum posting.
- Ganti `<domain>` dan pakai link UTM dari `PLAN.md` §6.
- Reddit / HN: **minta feedback, bukan promosi.** Baca aturan sidebar komunitas sebelum posting.

---

## 1. Reddit

### 1.1 r/vibecoding — minta feedback (minggu 2)

**Judul:** `I built a way for clients to leave feedback directly on vibe-coded apps (no account needed) — roast it?`

> I ship a lot of client sites with Lovable/Cursor. Building is fast now; the feedback loop isn't. Clients send WhatsApp screenshots like "the button on page 2 looks off on my phone" and half my time goes into finding *which* button.
>
> So I made a small script tag that:
> - lets a client click any element on the live site and type (or record) what's wrong, from a link — no account
> - saves the page, the element's selector and their device (browser, OS, screen size)
> - lets me copy all open comments as one prompt to paste into my AI coder
> - also runs simple user tests (tasks, 5-second tests, click heatmaps) from the same script
>
> It's free while in beta. I'm looking for honest feedback from people who actually ship with AI:
> 1. How do you collect feedback from clients/users today?
> 2. Would you want feedback to go straight into your editor (MCP) or into issues?
>
> Link in the comments if anyone wants to try it.

*(Taruh link di komentar pertama Anda sendiri kalau subreddit melarang link di post.)*

### 1.2 r/SideProject

**Judul:** `Side project: one script tag for client feedback + user tests, $2/site`

> Built this because my client feedback lived in WhatsApp screenshots. One script tag; clients review from a link without an account; every note has the page, element and device; copy it all as a prompt for your AI coder. Same script runs usability tasks and click heatmaps. Free during beta — feedback very welcome: <link>

### 1.3 r/webdev — thread *Showoff Saturday* (hanya Sabtu)

> **Showoff Saturday:** a feedback widget for client sites that loads ~5 KB for normal visitors and nothing else (the widget only loads for invited reviewers). Shadow DOM, never reads form values, kill switch from the panel. Would love feedback on the install experience: <link>

### 1.4 r/SaaS (maks 1x per 60 hari — pakai setelah ada angka)

**Judul:** `Pricing at $2/site when competitors charge $40+/month — sanity check?`

> Building a website-feedback + user-testing tool for freelancers/small agencies (often many client sites, little budget). Competitors charge per seat, $18–59/month. I'm testing a founding price of $2 per site, planned $5 later. Costs are mostly Supabase + storage for voice notes. What would you watch out for? Happy to share numbers so far: [angka nyata].

---

## 2. Indie Hackers (minggu 2; ulang setelah PH dengan hasilnya)

**Judul:** `From WhatsApp screenshots to one script tag: building a $2 feedback tool from Indonesia`

> **The problem.** I build sites for clients, increasingly with AI. Feedback still arrived as screenshots and voice notes on WhatsApp. Finding *where* the problem was took longer than fixing it.
>
> **What I built.** A script tag that puts comments on the live site. Clients review from a link with no account. Each note carries the page, element and device; I can copy all open notes as one prompt for my AI coder. The same script runs usability tasks, 5-second tests and click heatmaps.
>
> **Decisions so far.**
> - Normal visitors load ~5 KB and see nothing; the widget loads only for reviewers. (Customers' sites matter more than our features.)
> - $2 per site instead of per seat, because agencies have many sites and few seats.
> - No session recording of all visitors — Clarity does that for free; we focus on feedback you can act on.
>
> **Numbers (honest):** [pendaftar], [script terpasang], [komentar diterima], [pengguna berbayar].
>
> **What I'm unsure about:** whether to build Jira/Linear integration or an MCP server for AI editors first. Which would you use?
>
> Try it (free in beta): <link>

---

## 3. Show HN (minggu 5–6, setelah produk stabil & daftar < 1 menit)

**Judul (tanpa hype):** `Show HN: Vibe Collab – comments and user tests on any live site from one script tag`

**Teks:**
> Hi HN. This is a script tag that adds pinned comments, voice notes and simple user tests (tasks, 5-second tests, click heatmaps, and webcam eye tracking marked as experimental) to any website.
>
> Some design choices you might find interesting:
> - The snippet only carries a project id; behaviour comes from a published, versioned settings file on a CDN, so owners can roll back or kill the widget without redeploying.
> - Normal visitors load a ~5 KB (gzipped) loader that decides whether the widget is needed; reviewers arrive via a one-time token in the URL hash (read from the navigation entry, so apps that redirect on load still work).
> - The widget lives in a shadow root and never reads input values; labels are scrubbed for emails/phone numbers before anything is saved.
> - Backend is Postgres (Supabase) with row level security; writes go through SQL functions that check origin, reviewer and rate limits.
>
> It's free during the beta. I'd appreciate feedback on the architecture and on what would make you trust a third-party script like this on a production site.
>
> <link>

*Aturan: jangan minta teman upvote; jawab semua komentar teknis dengan jujur; tunggu 6–12 bulan sebelum Show HN berikutnya.*

---

## 4. X (Twitter) — thread peluncuran

> 1/ Building websites with AI got 10× faster. Getting feedback on them didn't.
> Clients still send WhatsApp screenshots: "the button on page 2 looks weird on my phone."
> So I built Vibe Collab. 🧵
>
> 2/ One script tag. Send your client a link — no account.
> They click the thing and type or say what's wrong.
>
> 3/ Every note knows the page, the exact element and the device (browser, OS, screen size). No more "which button?"
>
> 4/ Then: "Copy open as AI prompt" → paste into Cursor / Lovable / Claude Code.
>
> 5/ Same script runs user tests: tasks, 5-second tests, click heatmaps. (Webcam eye tracking too — labelled Labs, it's a webcam.)
>
> 6/ Your normal visitors load ~5 KB and see nothing.
>
> 7/ Free during beta, then $2 per site. Built in Indonesia 🇮🇩
> Try it → <link>
> What should it send feedback to next: Jira/Linear or your AI editor?

**Build in public (mingguan, 1 post):** angka minggu ini + 1 hal yang dipelajari + 1 screenshot. Contoh: *"Week 3: 41 sign-ups, 17 installed the script, 9 got a first comment. Biggest drop: installing. Shipping a 'paste this into Lovable' prompt next."*

---

## 5. LinkedIn — English

> Building with AI made shipping fast. Feedback is still slow.
>
> In my client work, feedback arrives as screenshots and voice notes on WhatsApp, and finding *which* button on *which* phone takes longer than the fix.
>
> I built Vibe Collab to put the review on the product itself: one script tag, clients review from a link (no account), and every note carries the page, element and device. You can turn open notes into a prompt for your AI coding tool, and run simple user tests and heatmaps from the same script.
>
> It's free during the beta. If you run an agency or freelance, I'd love 15 minutes of your honest feedback — comment or DM me.
>
> <link>

## 6. LinkedIn — Bahasa Indonesia

> Bikin website sekarang makin cepat, apalagi dengan AI. Tapi proses revisi dari klien masih lambat.
>
> Feedback datang lewat screenshot dan voice note di WhatsApp: "tombol di halaman kedua aneh di HP saya". Mencari tombol yang mana sering lebih lama daripada memperbaikinya.
>
> Karena itu saya membuat Vibe Collab: cukup satu baris script. Klien menerima satu link (tanpa perlu akun), klik bagian yang salah, lalu tulis atau rekam suara. Setiap catatan otomatis menyimpan halaman, elemennya, dan perangkat yang dipakai. Semua catatan bisa disalin jadi prompt untuk AI coder Anda. Script yang sama juga bisa dipakai untuk usability test dan heatmap.
>
> Gratis selama beta. Untuk teman-teman freelancer dan agensi: saya ingin 15 menit masukan jujur dari Anda — komentar atau DM ya.
>
> <link>

---

## 7. Komunitas Indonesia (Telegram / Facebook / Discord)

> Halo teman-teman 👋 izin share & minta masukan.
>
> Saya bikin tool kecil untuk yang sering revisi website dengan klien: klien cukup buka satu link (tanpa daftar akun), klik bagian yang mau direvisi, lalu ketik atau rekam suara. Di dashboard kita langsung tahu halaman, elemen, dan HP/laptop yang dipakai klien. Bisa juga untuk usability test dan heatmap sederhana.
>
> Pasangnya cukup satu baris script, jalan di WordPress, Webflow, Next.js, Lovable, dll. Gratis selama beta.
>
> Saya lagi cari 10 freelancer/agensi yang mau coba di 1 proyek klien dan kasih masukan jujur. Kalau berminat, balas di sini atau DM — saya bantu pasangkan langsung.
>
> <link>

*(Cek aturan grup; beberapa grup hanya membolehkan promosi di hari tertentu.)*

---

## 8. WhatsApp / DM ke kenalan (personal, satu per satu)

> Halo [nama], apa kabar? Aku lagi bikin tool untuk mempermudah revisi website dari klien — klien tinggal klik bagian yang salah di websitenya langsung, gak perlu screenshot-screenshot lagi. Kamu kan sering handle klien, boleh aku minta 15 menit buat coba di salah satu proyekmu dan kasih masukan jujur? Aku bantu pasangkan. Gratis kok. 🙏

**Follow-up (3 hari kemudian, sekali saja):**
> [nama], gimana, sempat coba? Kalau ada yang bikin ribet waktu pasang, kabari ya — itu masukan paling berharga buatku.

---

## 9. Pesan ke daftar pendukung saat Product Hunt (hari H)

**WA/Email (ID):**
> Hai [nama]! Hari ini Vibe Collab meluncur di Product Hunt 🚀 Kalau sempat, coba lihat dan tinggalkan komentar jujur di sana — masukan apa pun (termasuk kritik) sangat membantu. Link: [link PH]. Terima kasih banyak!

**EN:**
> Hi [name]! Vibe Collab is live on Product Hunt today. If you have a minute, I'd love your honest comment there — critique included: [PH link]. Thank you!

*(Jangan menulis "tolong upvote" — minta komentar/masukan.)*

---

## 10. Cold email / DM ke agensi (EN & ID)

**Subjek:** `Client feedback without screenshots — 15 min?`

> Hi [name], I saw [agency]'s work on [project] — [satu pujian spesifik].
> Quick question: how do your clients send revision feedback today? I'm building a small tool where clients click directly on the live site (no account) and you get the page, element and device for each note. Free during beta, $2/site after.
> Would you try it on one project? I'll set it up with you in 15 minutes.
> — [Nama], [link]

**ID:**
> Halo [nama], saya lihat karya [agensi] untuk [proyek] — [pujian spesifik].
> Boleh tanya, biasanya klien kirim revisi lewat apa? Saya sedang membuat tool supaya klien bisa klik langsung di website (tanpa akun), dan kita dapat halaman, elemen, dan perangkat untuk setiap catatan. Gratis selama beta.
> Mau coba di satu proyek? Saya bantu pasang 15 menit.

*Kirim maks 10–15 per hari, personal, tidak massal.*

---

## 11. Direktori & launch boards — teks pendek

- **Nama:** Vibe Collab
- **Tagline (60):** Client feedback and user tests on any live site
- **Deskripsi pendek (160):** One script tag adds pinned comments, voice notes and user tests to any website. Clients review via link, no account. $2 per site, free in beta.
- **Deskripsi panjang (≈500):** Vibe Collab puts feedback on the product itself. Add one script tag, send a client or teammate a link, and they click any element on your live site to type or record what's wrong — no account needed. Every note carries the page, the element and the device. Copy open notes as a prompt for your AI coding tool, share a read-only list, or export CSV. The same script runs usability tasks, 5-second tests and click heatmaps with people who agree to take part. Normal visitors load ~5 KB and see nothing. Free during the beta, then $2 per site per month.
- **Kategori:** Developer Tools, Design Tools, User Research, Website Feedback, No-code
- **Alternatif dari (untuk SaaSHub/AlternativeTo):** Marker.io, BugHerd, Userback, Ruttl, Pastel, Hotjar (feedback), Maze (usability tests)

**Daftar kirim:** BetaList · Peerlist Launchpad · Uneed · Microlaunch · DevHunt · Fazier · TinyLaunch · SaaSHub · AlternativeTo · There's An AI For That

---

## 12. Email ke pengguna beta (setelah Resend aktif)

**Subjek:** `Did your client leave the first comment yet?`

> Hi [name],
> Thanks for trying Vibe Collab. The moment it clicks is the first comment from a client, so here's the 2-minute path:
> 1. Open **Reviewers** → type their name → **Make link**.
> 2. Send it on WhatsApp/email. They click anything on your site and type or record.
> 3. You'll see it under **Results → Comments** with the page, element and device.
>
> Stuck installing? Reply to this email — I'll set it up with you.
> [Nama]
