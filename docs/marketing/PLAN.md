# Rencana pemasaran — modal hampir nol

*Head of marketing, 20 November 2026. Versi ini sudah melewati "roast" (lihat `ROAST.md`): rencana awal yang langsung ke Product Hunt diganti dengan urutan yang membangun audiens dulu.*

**File di folder ini:**
- `PLAN.md` — strategi, posisi, kalender 6 minggu, angka yang diukur (file ini).
- `PRODUCT-HUNT.md` — paket lengkap peluncuran Product Hunt (teks, gambar, video, jadwal jam per jam, jawaban komentar).
- `COPY.md` — semua teks siap pakai: Reddit, Indie Hackers, Show HN, X, LinkedIn, komunitas Indonesia, WhatsApp, cold email, direktori.
- `ROAST.md` — kritik keras atas rencana & materi, dan apa yang sudah diubah karenanya.

---

## 1. Prinsip (dari riset)

1. **Audiens hangat dulu, peluncuran belakangan.** Hampir semua panduan Product Hunt 2026 menyebut audiens yang sudah kenal produk sebagai prediktor terkuat; Featured dipilih editor (Useful, Novel, High Craft, Creative). Meluncur ke ruangan kosong = sia-sia sekali tembak.
2. **Jual ke satu orang dulu.** ICP #1: **freelancer & agensi web kecil di Indonesia/SEA**. Mereka paling cepat merasakan sakitnya (feedback klien lewat WhatsApp) dan punya banyak situs.
3. **Gratis > berbayar, tapi waktu itu mahal.** Satu kanal utama per minggu, dikerjakan sampai tuntas.
4. **Jangan spam, jangan beli upvote.** Reddit & HN menghukum promosi; Product Hunt bisa un-feature. Minta *feedback*, bukan *upvote*.
5. **Product Hunt = kredibilitas, bukan mesin akuisisi.** Pelanggan pertama (agensi Indonesia) datang dari percakapan langsung dan komunitas lokal; Product Hunt memberi backlink, pengguna global awal dan bukti sosial.
6. **Ukur semuanya.** Setiap link memakai UTM (`?utm_source=reddit&utm_campaign=launch`); PostHog otomatis mencatat sumber kunjungan pertama.

---

## 2. Posisi & pesan

**Kategori:** website feedback + user testing dalam satu script.

**Satu kalimat (EN):** *Client feedback and user tests on your live site — one script tag, $4.80 a site ($2 founding).*

**Satu kalimat (ID):** *Feedback klien dan tes pengguna langsung di situs Anda — satu baris script, Rp 29 ribu per situs.*

**Tiga alasan memilih kita (dalam urutan ini):**
1. **Klien tidak perlu akun.** Kirim satu link; mereka klik elemen, ketik atau rekam suara. Browser, OS dan ukuran layar ikut tercatat.
2. **Feedback + riset dalam satu tempat.** Usability test, 5-second test, heatmap (dan eye tracking, Labs) memakai script yang sama — tidak perlu langganan Maze terpisah.
3. **$4,80 per situs (founding $2 untuk 200 pelanggan pertama).** ±40% di bawah pasar; pesaing $18–59 per bulan, sering per orang.

**Bonus untuk vibe coder:** *Copy fix prompt* — feedback jadi prompt siap tempel ke Cursor/Lovable/Claude Code.

**Yang TIDAK boleh diklaim (belum ada):** screenshot otomatis, integrasi Jira/Linear/GitHub, MCP, widget Bahasa Indonesia, notifikasi email — kecuali sudah dibangun sebelum materi dipublikasikan. *(Lihat `ROAST.md` #3.)*

**Bantahan yang sering muncul:**

| Keberatan | Jawaban |
|---|---|
| "Vercel sudah punya comments gratis" | Reviewer Vercel di paket gratis harus punya akun Vercel, dan hanya di preview. Kita: tanpa akun, di produksi, di hosting apa pun, plus usability test & heatmap. |
| "Kenapa tidak Marker.io / BugHerd?" | Mereka bagus untuk tim besar ($39–59+/bulan, per kursi). Kita untuk freelancer/agensi kecil yang punya banyak situs: $4,80/situs (founding $2), tanpa kursi. |
| "$2? Pasti akan naik / tutup" | Harga founding $2 dikunci untuk 200 pelanggan pertama; harga normal $4,80/situs (±40% di bawah pasar). Data bisa diekspor (CSV) kapan saja. |
| "Aman di situs saya?" | Pengunjung biasa hanya memuat ±5 KB dan tidak melihat apa pun. Script tidak pernah membaca isi kolom form, berjalan di shadow DOM, bisa dimatikan dari panel tanpa ubah kode. |
| "Eye tracking pakai webcam akurat?" | Tidak seakurat alat lab — makanya label Labs. Cocok untuk melihat area yang dilihat, bukan kata per kata. |

---

## 3. Kalender 6 minggu

> Minggu 0 adalah syarat; jangan lompat ke Product Hunt sebelum minggu 0 beres.

### Minggu 0 — Siap jual (wajib sebelum promosi besar)
- [ ] Putuskan **nama final & domain** (Product Hunt dan backlink menempel ke nama/URL ini selamanya).
- [ ] Aktifkan **PostHog** (lihat panduan) dan **Resend** (email).
- [ ] Bangun MVP minimum yang paling dicari: **screenshot di komentar** dan **notifikasi email** (lihat `docs/PRODUCT-ANALYSIS.md` §6). Tanpa ini, review Product Hunt akan membandingkan kita dengan Marker.io dan kita kalah.
- [ ] Rekam **video demo 45 detik** (skrip di `PRODUCT-HUNT.md`).
- [ ] Panduan khusus **"Add it to a Lovable / Bolt / v0 app"** (halaman guide + post SEO): aktivasi vibe coder paling sering macet di sini.
- [ ] (Disarankan sebelum outreach agensi) **widget Bahasa Indonesia** — klien lokal orang awam.
- [ ] Buat akun **Product Hunt**, **X**, **Reddit**, **Indie Hackers**, **Hacker News**, **Peerlist** sekarang (akun baru dibatasi; mulai aktif berkomentar).

### Minggu 1 — Jaringan sendiri & Indonesia (target: 10 pengguna aktif)
- [ ] WhatsApp/DM personal ke 30 kenalan freelancer/agensi (template `COPY.md` §8). **Tawarkan dipasangkan langsung** (15 menit video call).
- [ ] Post di LinkedIn (ID & EN) dan X: cerita kenapa membuat produk ini (`COPY.md` §5–6).
- [ ] Posting di 2–3 komunitas Indonesia (Telegram UI/UX Indonesia, grup Facebook web developer, Discord) — format minta feedback (`COPY.md` §7).
- [ ] Daftar **BetaList** (antrian gratis bisa berminggu-minggu — daftar sekarang).

### Minggu 2 — Komunitas global (target: 30 pengguna, 10 testimoni/feedback)
- [ ] **r/vibecoding** (±252 ribu anggota): post "minta feedback" (`COPY.md` §1.1). Baca aturan sidebar dulu.
- [ ] **r/SideProject** dan **r/webdev** (thread *Showoff Saturday*, hanya Sabtu).
- [ ] **Indie Hackers**: post cerita + angka nyata (`COPY.md` §2).
- [ ] **Peerlist Launchpad** (gratis, mingguan).
- [ ] Setiap hari: 20 menit membalas thread orang lain yang bertanya "how do I collect feedback on my Lovable app" dll. — bantu dulu, link kalau relevan.

### Minggu 3 — Launch boards & listing (target: backlink + 50 pengguna)
- [ ] **Uneed** (gratis antre, atau ±$15–30 pilih tanggal), **Microlaunch**, **DevHunt** (developer tools), **Fazier**, **TinyLaunch**.
- [ ] Listing permanen: **SaaSHub**, **AlternativeTo** (sebagai alternatif Marker.io, BugHerd, Userback), **There's An AI For That** (karena fix prompt).
- [ ] Kumpulkan 5–10 kutipan testimoni **nyata** (dengan izin) untuk Product Hunt.

### Minggu 4 — Product Hunt (target: Top 10 hari itu; 100+ pendaftar)
- [ ] Ikuti `PRODUCT-HUNT.md` jam per jam. Selasa–Kamis 00:01 PT (= **15:01 WIB** saat PST / 14:01 WIB saat PDT). Kalau audiens masih kecil, pertimbangkan **Sabtu/Minggu** (persaingan lebih rendah).
- [ ] Umumkan di semua kanal dengan kalimat "kami meluncur hari ini, kami butuh masukan Anda".

### Minggu 5–6 — Show HN & konten jangka panjang
- [ ] **Show HN** (hanya jika siapa pun bisa daftar & mencoba < 1 menit; `COPY.md` §3).
- [ ] Mulai **halaman perbandingan SEO**: "Marker.io alternative", "BugHerd alternative", "how to collect feedback on a Lovable app", "usability test without Maze" — satu per minggu.
- [ ] Studi kasus pertama dari pengguna Indonesia (izin tertulis).

---

## 4. Anggaran

| Item | Biaya | Wajib? |
|---|---|---|
| Domain (.com/.app/.id) | ±$10–20/tahun | Ya |
| Uneed pilih tanggal | ±$15–30 | Opsional |
| Semua kanal lain | $0 | — |
| **Total** | **< $50** | |

Yang **tidak** layak dibeli sekarang: iklan berbayar, "upvote services", paket "launch agency". Waktu lebih baik dipakai untuk 30 percakapan langsung dengan agensi.

---

## 5. Angka yang dipantau (mingguan, di PostHog)

| Metrik | Target 6 minggu |
|---|---|
| Pendaftar (`signup_completed`) | 150 |
| Script terdeteksi (`script_detected`) | 60 (40%) |
| Komentar pertama (`first_comment_received`) | 40 (25%) |
| Proyek aktif minggu ke-4 | 20 |
| Testimoni nyata | 10 |
| Peringkat Product Hunt | Top 10 hari itu |
| Sumber terbaik | lihat `$initial_utm_source` |

**Aturan berhenti:** kanal yang setelah 2 percobaan menghasilkan < 5 pendaftar → hentikan, pindahkan waktu ke kanal yang berhasil.

---

## 6. Link dengan UTM (salin pakai)

| Kanal | Link |
|---|---|
| Product Hunt | `https://whatvibecodingcando.vercel.app/?utm_source=producthunt&utm_campaign=launch` |
| Reddit | `https://whatvibecodingcando.vercel.app/?utm_source=reddit&utm_campaign=feedback` |
| Indie Hackers | `https://whatvibecodingcando.vercel.app/?utm_source=indiehackers` |
| Hacker News | `https://whatvibecodingcando.vercel.app/?utm_source=hn` |
| X | `https://whatvibecodingcando.vercel.app/?utm_source=x` |
| LinkedIn | `https://whatvibecodingcando.vercel.app/?utm_source=linkedin` |
| WhatsApp/DM | `https://whatvibecodingcando.vercel.app/?utm_source=dm` |
| Komunitas ID | `https://whatvibecodingcando.vercel.app/?utm_source=komunitas` |

*(Ganti domain setelah domain final dipasang.)*

---

## Sumber riset
- Product Hunt: [Launch Guide resmi](https://www.producthunt.com/launch/preparing-for-launch), [LaunchPact 2026](https://www.launchpact.io/product-hunt-launch-strategy), [daily.dev checklist](https://daily.dev/blog/product-hunt-launch-checklist-developer-tools/), [Causo playbook](https://hub.causo.ai/guides/product-hunt-launch-2026-realistic-playbook), [smollaunch](https://smollaunch.com/guides/launching-on-product-hunt)
- Alternatif launch: [Uneed](https://www.uneed.best/alternatives/product-hunt), [SaaSCity](https://saascity.io/blog/product-hunt-alternatives-saas-2026), [smollaunch best-of](https://smollaunch.com/best-of/best-product-hunt-alternatives-for-indie-makers-2026)
- Show HN: [aturan resmi](https://news.ycombinator.com/showhn.html), [Lucas F. Costa](https://www.lucasfcosta.com/hn-launch)
- Reddit: [SaaSCity — subreddit untuk indie hackers](https://saascity.io/best-subreddits-for-indie-hackers), [Discury — Reddit SaaS marketing](https://discury.io/pulse-reddit-saas-marketing-d9ee)
- Komunitas Indonesia: [daftar grup Telegram pemrograman Indonesia](https://fr.github.com/hendisantika/List-All-Programming-Telegram-Group)
