# Analisis produk & market fit — ourhunch

*Ditulis 20 November 2026. Sudut pandang: head of product, design, engineering dan marketing. Angka pasar dan harga pesaing dari riset web (daftar sumber di bawah); cek ulang sebelum dipakai di materi publik.*

---

## 1. Ringkasan satu paragraf

ourhunch memecahkan masalah yang nyata: produk yang dibuat cepat (dengan AI atau tidak) tetap butuh **feedback dari klien, tim dan pengguna, langsung di halaman yang hidup**. Pasarnya besar dan tumbuh (platform vibe coding seperti Lovable dilaporkan ±$400 juta ARR awal 2026 dan ±8 juta pengguna terdaftar), tapi **kategori "website feedback" sudah ramai** (Marker.io, BugHerd, Userback, Ruttl, Feedbucket, Faster Fixes, Feedboon; plus komentar gratis bawaan Vercel). Fitur "kirim feedback ke AI coder" yang kita kira unik **sudah dimiliki beberapa pesaing lewat MCP**. Pembeda kita yang sebenarnya: **(1) harga $2/situs vs $18–59/bulan pesaing, (2) feedback + riset pengguna (usability test, heatmap, 5-second test) dalam satu script, (3) fokus pasar Indonesia/Asia Tenggara (Rupiah, QRIS, Bahasa Indonesia).** Untuk MVP yang layak ditagih, empat hal wajib: **screenshot di komentar, notifikasi email, MCP/API untuk AI coder, dan billing.**

---

## 2. Pasar

| Fakta | Angka | Catatan |
|---|---|---|
| Ukuran pasar "vibe coding" 2026 | ±$4,7–9,4 miliar (estimasi berbeda-beda) | Sumber sekunder; jangan dikutip sebagai fakta pasti |
| Lovable | ±$400 juta ARR (Feb 2026), ±8 juta pengguna terdaftar | Dilaporkan TechCrunch via sumber sekunder |
| Bolt.new | ±$40 juta ARR, 5 juta pengguna (Maret 2025) | Data lama, kemungkinan lebih besar sekarang |
| r/vibecoding | ±252 ribu anggota | Komunitas utama vibe coder |
| Pengguna non-developer di platform vibe coding | ±63% (satu survei, sumber tidak jelas) | Indikatif saja |

**Artinya:** jutaan orang membuat aplikasi tanpa tim QA atau desainer. Mereka (dan klien mereka) butuh cara gampang untuk bilang "ini salah, di sini" — dan banyak yang **tidak** mampu bayar $40–60/bulan per proyek.

---

## 3. Pesaing (harga perkiraan 2026, dari blog perbandingan pihak ketiga)

| Produk | Harga mulai | Kelebihan | Kelemahan vs kita |
|---|---|---|---|
| **Marker.io** | ±$39–59/bln (3 user), tanpa free plan | Screenshot, integrasi Jira/Linear/GitHub matang, agensi | Mahal, tidak ada riset pengguna |
| **BugHerd** | ±$50/bln (5 user) | Populer di agensi | Mahal, per kursi |
| **Userback** | Free 2 kursi; berbayar ±$7–39 | Free plan, **MCP** (console log, network) | Per kursi |
| **Ruttl** | Free terbatas; Pro ±$18/user/bln | Murah, desainer suka | Per user, bukan per situs |
| **Feedbucket** | (agensi) | **MCP** resmi | Harga agensi |
| **Faster Fixes** | Open source (MIT) | Widget React + MCP gratis | Harus pasang sendiri, React-only, butuh developer |
| **Feedboon** | (tidak dicek) | Satu script, screenshot, console error, MCP | Langsung bersaing di ICP vibe coder |
| **Vercel Comments** | Gratis di preview deployment | Sudah ada di Vercel | Reviewer di paket gratis harus punya akun Vercel; hanya preview; tidak ada riset |
| **Microsoft Clarity** | Gratis | Heatmap & rekaman semua pengunjung | Bukan alat feedback; kita **tidak** bersaing di sini |
| **Maze / Lyssna** | Puluhan–ratusan $/bln | Usability test matang | Mahal; terpisah dari feedback |

**Kesimpulan jujur:** kita tidak akan menang dengan "fitur lebih banyak dari Marker.io". Kita menang dengan **harga yang tidak perlu dipikir**, **satu script untuk feedback + riset**, dan **kedekatan pasar lokal**.

---

## 4. Siapa pelanggan pertama (ICP)

Urutan prioritas — fokus ke #1 dulu, karena paling cepat menghasilkan pengguna yang membayar:

1. **Freelancer & agensi kecil web di Indonesia/SEA** (1–10 orang) yang membuat situs untuk klien, sering dengan AI. Rasa sakitnya: *feedback klien datang lewat WhatsApp berupa screenshot dan voice note yang campur aduk; revisi bolak-balik.* Mereka punya banyak situs (= banyak $2), dan klien mereka orang awam (butuh antarmuka sederhana, idealnya Bahasa Indonesia).
2. **Indie maker / vibe coder** yang meluncurkan aplikasi ke pengguna pertama dan butuh feedback + bukti apakah orang bisa memakai aplikasinya (usability test murah).
3. **Tim produk kecil (startup tahap awal)** yang butuh usability test dan heatmap tanpa langganan Maze.

**Bukan target (sekarang):** enterprise, tim QA besar, orang yang butuh analytics semua pengunjung (pakai Clarity).

---

## 5. Audit fitur saat ini

| Fitur | Status | Nilai untuk ICP #1 | Keputusan |
|---|---|---|---|
| Comments (pin di elemen, balasan, status) | Siap | ⭐ Inti | Pertahankan, tingkatkan (screenshot) |
| Review link sekali pakai (tanpa akun) | Siap | ⭐ Pembeda kuat vs Vercel (reviewer tidak perlu akun) | Tonjolkan di pemasaran |
| Konteks perangkat (browser, OS, ukuran layar) | Siap | Tinggi | Pertahankan |
| Copy fix prompt (AI) | Siap | Sedang (pesaing punya MCP) | Lanjutkan ke MCP/API |
| Voice notes | Siap (belum diuji di server asli) | Tinggi untuk klien awam | Uji, tonjolkan |
| A vs B (component review) | Siap | Rendah–sedang | Pertahankan sebagai jenis komentar |
| Share link daftar komentar, CSV | Siap | Tinggi (laporan ke klien) | Pertahankan |
| Usability test, 5-second test, heatmap | Siap | Tinggi untuk ICP #2–3 | Bagian "Pro" utama |
| Participant paths, Report | Siap | Sedang | Otomatis di Pro |
| Eye tracking (Labs) | Eksperimental | Rendah (akurasi webcam) | Simpan sebagai magnet pemasaran, jangan dijanjikan |
| Inspect, Design system check, Design tokens | Siap | Rendah untuk klien; sedang untuk desainer | Gratis, jangan jadi fokus |
| Fake doors | Coming soon | — | Bangun setelah MVP |
| Dashboard, Update site, History, Open my site, Guide | Siap | Tinggi (onboarding) | Pertahankan |

---

## 6. Yang kurang untuk MVP (urut prioritas)

**MVP = versi yang layak ditagih $2 dan tidak membuat pengguna pergi di minggu pertama.**

| # | Fitur | Kenapa wajib | Perkiraan kerja |
|---|---|---|---|
| 1 | **Screenshot otomatis di setiap komentar** | Semua pesaing punya; developer butuh melihat apa yang dilihat reviewer. Tanpa ini kita terlihat "kurang". | Sedang (render bagian layar di browser reviewer, simpan di storage privat) |
| 2 | **Notifikasi email** (komentar baru, ringkasan harian) | Tanpa ini pemilik lupa membuka panel → churn. | Sedang (perlu Resend/SMTP) |
| 3 | **Billing + batas paket** (Free 1 situs / Pro $2) | Supaya bisa mulai menagih; batas dicek di server. | Sedang–besar (Xendit atau Lemon Squeezy + webhook) |
| 4 | **MCP server / API "open comments"** | Pesaing sudah punya; vibe coder ingin AI coder membaca feedback langsung, menandai selesai. Kita sudah punya `fixPrompt`, tinggal dibuka lewat API. | Sedang |
| 5 | **Widget dalam Bahasa Indonesia** (otomatis dari bahasa browser) | Klien agensi Indonesia orang awam; pesaing semua berbahasa Inggris. **Pembeda lokal termurah.** | Kecil–sedang |
| 6 | **Error console terlampir** (opsional, data pribadi disamarkan) | Laporan bug lengkap tanpa reviewer paham teknis. | Kecil–sedang |
| 7 | **Notifikasi Telegram/WhatsApp** | Agensi Indonesia hidup di WhatsApp. Telegram bot gratis & mudah; WhatsApp Business API berbayar. | Kecil (Telegram) |

**Sesudah MVP (v1.1+):** integrasi GitHub Issues / Linear / Jira, Fake doors untuk pengunjung asli, tombol "Send feedback" & survei mini untuk pengunjung (mode Live), versi otomatis dari deploy.

**Yang sengaja tidak dibuat:** rekaman sesi semua pengunjung (Clarity gratis), analytics umum, AI summary sebelum ada volume.

---

## 7. Harga — pendapat jujur

- **$2/situs/bulan sangat murah** dibanding pesaing ($18–59). Bagus untuk akuisisi dan pasar Indonesia, tapi ada dua risiko:
  1. **Sinyal kualitas:** sebagian pembeli B2B menganggap terlalu murah = tidak serius.
  2. **Margin tipis:** biaya tetap ±$45–65/bulan (Supabase Pro, Vercel Pro, email) → butuh ±30 situs berbayar untuk impas; storage screenshot & voice note menambah biaya per situs.
- **Rekomendasi:** pertahankan **$2 sebagai harga "Founding member"** yang dikunci seumur hidup untuk 100–200 pelanggan pertama, dan umumkan sejak awal bahwa harga normal nanti **$5/situs** (masih jauh di bawah pesaing). Ini memberi alasan "beli sekarang" tanpa merusak ekonomi jangka panjang.
- **Bayar tahunan** untuk internasional ($24/tahun) supaya potongan payment processor tidak memakan 18–30% tagihan.

---

## 8. Product–market fit: bagaimana mengukurnya

Jangan menebak — ukur dengan PostHog (sudah terpasang, aktif setelah key diisi):

| Sinyal | Target 60 hari | Event |
|---|---|---|
| Aktivasi (script terpasang & terdeteksi) | ≥40% dari yang daftar | `script_detected` / `signup_completed` |
| "Aha" (komentar pertama diterima) | ≥25% dari yang daftar | `first_comment_received` |
| Retensi minggu ke-4 (masih menerima komentar) | ≥20% proyek aktif | dashboard PostHog / `project_stats` |
| Bersedia bayar | ≥10 pelanggan berbayar dari 100 aktif | billing |
| Tes Sean Ellis ("seberapa kecewa jika produk ini hilang?") | ≥40% "sangat kecewa" | survei ke pengguna aktif |

Kalau aktivasi rendah → masalah di instalasi (perbaiki onboarding). Kalau aktivasi tinggi tapi "aha" rendah → masalah mengundang reviewer (perbaiki review link, tambah Bahasa Indonesia). Kalau "aha" tinggi tapi tidak bayar → nilai belum cukup (screenshot, notifikasi, integrasi).

---

## 9. Risiko utama

1. **Pesaing gratis/murah dengan MCP** (Faster Fixes open source, Userback free). → Jawaban: kita bukan hanya feedback; riset + harga + lokal.
2. **Vercel Comments gratis** untuk developer di Vercel. → Jawaban: reviewer kita tidak butuh akun, bekerja di produksi & semua hosting, ada riset.
3. **Nama "ourhunch" masih nama kerja** dan terdengar umum/terikat tren "vibe". → Putuskan nama & domain sebelum Product Hunt.
4. **Satu orang founder, token terbatas.** → Fokus: MVP 4 fitur, satu ICP, satu kanal utama per minggu.
5. **Kepatuhan privasi (UU PDP)** untuk riset dengan peserta. → Sudah ada consent & redaksi; perlu review hukum sebelum skala.

---

## Sumber
- [Product Hunt launch guides 2026 (LaunchPact)](https://www.launchpact.io/product-hunt-launch-strategy), [daily.dev checklist](https://daily.dev/blog/product-hunt-launch-checklist-developer-tools/), [Product Hunt Launch Guide](https://www.producthunt.com/launch/preparing-for-launch)
- Harga pesaing: [Feedbucket — Marker.io alternatives](https://www.feedbucket.app/marker-io-alternatives/), [Feedbucket — BugHerd alternatives](https://www.feedbucket.app/bugherd-alternatives/), [Featurebase — Marker alternatives](https://www.featurebase.app/blog/marker-alternatives), [ReviseFlow](https://reviseflow.io/blog/marker-io-alternatives), [Framekit](https://framekit.ai/blog/best-website-feedback-tools-2026)
- Pasar vibe coding: [13labs](https://www.13labs.au/blog/vibe-coding-tools-2026), [ideaplan](https://www.ideaplan.io/ideas/trends/vibe-coding-ai-app-builders), [agentmarketcap](https://agentmarketcap.ai/blog/2026/04/13/agentic-web-development-platforms-bolt-replit-lovable-vs-coding-agents-2026)
- MCP pesaing: [Faster Fixes MCP](https://chat.mcp.so/server/faster-fixes/manucoffin), [Feedbucket MCP](https://help.feedbucket.app/en/article/feedbucket-mcp-server-1iqtu19/), [Userback MCP](https://userback.io/feature/mcp-integration/), [Feedboon](https://feedboon.com/use-cases/website-feedback)
- [Vercel Comments docs](https://vercel.com/docs/comments)
