# HANDOFF — status ourhunch (selalu diperbarui)

*Dokumen serah-terima utama. Setiap pekerjaan baru **wajib** menambah catatan di "Log perubahan" dan memperbarui bagian "Yang harus dilakukan pemilik". Ditulis untuk pemilik (Bahasa Indonesia) dan bisa dibaca AI/developer lain.*

Terakhir diperbarui: 2 Desember 2026

---

## 1. Ringkasan sistem

| Bagian | Alamat | Kode |
|---|---|---|
| Website (landing) | https://ourhunch.com/ | `apps/landing` |
| Aplikasi / panel | https://ourhunch.com/app (panel `#/app`) | `apps/saas` |
| Admin internal (founder saja) | https://ourhunch.com/app#/admin — login sendiri | `apps/saas/src/pages/saas/ops/` |
| Script pelanggan | `https://ourhunch.com/embed/vibe.js` (jangan dipindah) | `apps/saas/src/core/embed/` |
| Halaman coba widget | https://ourhunch.com/embed-demo.html | `apps/saas/public/embed-demo.html` |
| Database & auth | Supabase `nxrmvaehrjgpbkmfuzry` (Singapore) | `apps/saas/supabase/` |
| Hosting | Vercel, project **whatvibecodingcando**, **hanya branch `main` yang di-build** | `vercel.json` |
| Email | Resend (kirim, domain ourhunch.com terverifikasi) · ImprovMX (terima → Gmail) | `supabase/functions/send-emails` |
| Analytics | PostHog (website + panel saja) | `docs/POSTHOG.md` |
| Pembayaran | Paddle — **siap tapi MATI** | `docs/BILLING.md` |

Dokumen penting lain: `docs/TESTING.md` (tes manual), `docs/SECURITY-AUDIT-2026-11.md`, `docs/BILLING.md`, `docs/POSTHOG.md`, `docs/LEGAL-TODO.md`, `apps/saas/supabase/README.md` (setup server lengkap).

---

## 2. Yang harus dilakukan pemilik (checklist hidup)

Centang di sini setiap kali selesai. ✅ = sudah dikonfirmasi pemilik/tes, ⬜ = belum, ❓ = belum dikonfirmasi.

### Database (Supabase → SQL Editor), urutan file di `apps/saas/supabase/catch-up/`
| File | Isi | Status |
|---|---|---|
| `2026-11-22-research-scale-email.sql` | riset, skala, email dasar | ✅ |
| `2026-11-24-pins-rounds-ops.sql` | pin tahan deploy, review rounds, admin | ✅ |
| `2026-11-25-emails.sql` | sistem email lengkap | ✅ |
| `2026-11-25-heatmap-v3.sql` | heatmap v3 | ✅ |
| `2026-11-25-ops-usage.sql` | status widget di admin, welcome email | ✅ |
| `2026-11-26-heatmap-v4.sql` | heatmap v4 (akurasi) | ✅ |
| `2026-11-26-billing.sql` | pembayaran (mati) | ❓ |
| `2026-11-26-security.sql` | pengerasan keamanan (setelah billing) | ❓ |
| `2026-11-27-install-flow.sql` | alur instalasi: banner alamat localhost baru (jalankan setelah security) | ⬜ |
| `2026-11-28-default-heatmap.sql` | heatmap otomatis: studi "Site heatmap", klik reviewer/tim, link undangan (jalankan setelah install-flow) | ⬜ |
| `2026-11-28-demo-origin.sql` | demo di ourhunch.com bisa dipakai link review | ⬜ |
| `2026-11-29-default-studies.sql` | satu studi default ★ per modul riset, pengunjung di mode Everyone (persetujuan satu klik), pengunjung tidak bisa membaca hasil (jalankan setelah demo-origin) | ⬜ |
| `2026-12-01-snapshots-layouts.sql` | eye tracking wajib kamera (run tanpa gaze dikecualikan, `discard_run`), versi layout per halaman, snapshot halaman + bucket privat `snapshots` + policy (jalankan setelah default-studies). Kalau baris `insert into storage.buckets` ditolak: buat bucket manual (lihat README Supabase "Page snapshots") lalu jalankan ulang | ⬜ |
| `2026-12-02-studies-guard.sql` | setiap modul riset yang aktif selalu punya minimal satu studi: ★ terakhir tidak bisa dihapus (`last_study`), menghapus ★ memindahkan ★ (pilihan pemilik atau yang terbaru), fungsi `delete_study` untuk panel (jalankan setelah snapshots-layouts). Sebelum dijalankan, panel memakai hapus biasa (tanpa penjaga) | ⬜ |

Semua file aman dijalankan ulang kecuali disebut lain. Admin: `insert into public.platform_admins (user_id) select id from auth.users where email = '<email>';` ✅

### Email
- ✅ Domain Resend terverifikasi (DKIM + SPF). "Enable receiving" di Resend harus **mati** (penerimaan lewat ImprovMX).
- ✅ Fungsi `send-emails` ter-deploy (JWT verification off).
- ❓ Jadwal cron berjalan dengan status **200** (cek: `select status_code, left(content::text,150), created from net._http_response order by created desc limit 3;`). Kalau 401: samakan `EMAIL_CRON_SECRET` (Edge Functions → Secrets) dan secret Vault `email_cron_secret`.
- ⬜ SMTP Supabase Auth → Resend (`smtp.resend.com`, 465, user `resend`).
- ⬜ 5 template email Auth ditempel (file di `apps/saas/supabase/email-templates/`; Magic Link & Confirm signup berisi kode 6 digit, subjek `Your ourhunch code: {{ .Token }}`).
- ⬜ Auth → Email OTP length 6, expiry 600, rate limits.
- ⬜ Secret `EMAIL_FOUNDER_NAME`, `EMAIL_POSTAL_ADDRESS`, `EMAIL_REPLY_TO`.

### Keamanan (dari audit)
- ⬜ **Repo GitHub jadi private** (paling penting).
- ⬜ Turnstile CAPTCHA (README Supabase langkah 4).
- ⬜ 2FA: GitHub, Vercel, Supabase, Resend, PostHog, registrar domain, email.
- ⬜ Supabase Pro (backup harian).
- ⬜ **Vercel Pro (±$20/bulan)** sebelum promosi publik atau menyalakan pembayaran: paket Hobby hanya untuk penggunaan non-komersial (risiko project ditangguhkan = situs dan script pelanggan mati). Tidak ada perubahan kode.
- ⬜ Rotasi kunci yang pernah tampil di chat/screenshot.

### Lainnya
- ⬜ Google Auth Platform → submit verifikasi branding (agar tertulis "ourhunch" di layar Google).
- ⬜ Search Console → submit `sitemap.xml`.
- ⬜ PostHog → aktifkan Group analytics, buat funnel (`docs/POSTHOG.md`).
- ⬜ Isi placeholder legal (`docs/LEGAL-TODO.md`), review pengacara sebelum menagih.
- ⬜ Pembayaran: daftar Paddle → `docs/BILLING.md` (konfirmasi Paddle menerima penjual Indonesia).

---

## 3. Keputusan produk yang berlaku

- Widget **bahasa Inggris** (tidak ada versi Indonesia).
- Harga: Free 1 situs; Pro **$4.80/situs/bulan**; founding **$2** untuk 200 pelanggan pertama; Pro gratis selama beta.
- Login email = **kode 6 digit** (password opsional); Google sekali klik. Admin login terpisah, email + password.
- Widget **tersembunyi untuk pengunjung biasa** selama audiens = *Reviewers only* (default, dan semua proyek lama tetap begitu); hanya tim (lewat "Open my site") dan reviewer (link review) yang melihatnya.
- **Satu modul satu studi default ★**: Heatmap → "Site heatmap", Eye tracking → "Eye tracking", 5-second test → "First impression" (halaman yang sedang dibuka, pertanyaan "What is this page about?"), Usability test → "Usability test" (satu tugas "Explore the site and find what you came for", bisa diedit). Dibuat otomatis saat modul dinyalakan. Boleh banyak studi per modul, tapi **hanya ★ yang menerima lalu lintas widget**; studi lain hanya lewat link-nya sendiri. **Make default** memindahkan ★; data tetap di studi masing-masing. Pause pada ★ = modul berhenti mengumpulkan (pengunjung tidak melihat modulnya).
- **Everyone = semua modul + persetujuan satu klik tanpa nama**: pengunjung melihat semua modul yang aktif; modul riset bertanya satu kalimat (OK / No thanks). Hanya yang menekan OK direkam, ke studi ★ modul itu. Modul yang tidak bisa jalan (mis. tanpa kamera) tetap tampil dengan alasan singkat.
- **Pengunjung tidak bisa melihat hasil**: heatmap, tabel elemen, link undangan dan data orang lain hanya untuk tim dan reviewer undangan — dipaksa di server (`reviewers.visitor`).
- **Instalasi lama tidak berubah**: snippet sama, audiens tidak diubah, studi/link/data lama tetap; studi non-default tetap hanya lewat link. Satu-satunya hal baru yang terlihat: studi ★ baru di Research untuk modul riset yang sudah aktif. (Catatan: proyek yang *sudah* memilih Everyone dan punya modul riset aktif kini memperlihatkan tombol riset ke pengunjung — tetap tidak merekam apa pun sebelum OK.)
- Heatmap **otomatis**: tiap proyek dengan Heatmaps punya satu studi "Site heatmap" yang selalu terbuka. **Klik reviewer dan tim (Open my site) ikut tercatat secara default**, dengan pemberitahuan sekali dan tombol mati per orang. Orang lain hanya lewat link undangan + layar persetujuan. Pengunjung biasa tidak direkam kecuali audiens = Everyone **dan** mereka menekan OK (lihat di bawah). Eye tracking = Labs (perkiraan).
- "Collect clicks from all visitors" **tanpa persetujuan** tetap TIDAK dibuat; yang ada sekarang: Everyone + OK per modul.
- Eye tracking dari widget: ada untuk mode Everyone (OK → izin kamera → kalibrasi singkat).
- PostHog `visitor_consented` **tidak dibuat**: aturan proyek melarang PostHog di script yang berjalan di situs pelanggan. Yang dikirim dari panel: `study_added`, `study_default_changed` (id/modul saja).
- **Hasil dibaca di dashboard**, bukan di situs: tombol Heatmap di widget = partisipasi (+ link ke panel); overlay hasil hanya terbuka lewat *View heatmap* di panel. Item menu untuk modul yang mati **disembunyikan** (bukan diredupkan) agar menu pendek; halaman Research tetap menunjukkan modul "Off".
- Ditahan: "Fixed, please check", error konsol di komentar, MCP.
- **Eye tracking wajib kamera di modul Eye tracking**: menolak kamera / tanpa kamera / kalibrasi dihentikan = partisipasi selesai, run dihapus, pesan "Eye tracking needs your camera. Nothing was recorded.". Di server run modul gaze tanpa titik gaze ditandai `excluded` dan tidak dihitung. Hanya di studi lain (usability/5-detik dengan eye tracking tambahan) boleh lanjut: "Continue the test without eye tracking".
- **Snapshot halaman**: ON untuk proyek baru, **OFF untuk proyek lama** (instalasi lama tidak berubah). Hanya dari tim/reviewer/peserta lewat link (diberi tahu di layar persetujuan), tidak pernah dari pengunjung biasa. Selalu disamarkan. Mematikan setting menghapus snapshot tersimpan.
- **Versi layout otomatis**: hasil tidak pernah dicampur antar layout; data lama = "unknown layout". Di laporan eye tracking satu halaman = satu baris (orang unik), layout = tab.
- **Satu modul aktif = minimal satu studi**: ★ terakhir hanya bisa di-Pause, tidak dihapus (dipaksa di server). Hapus ★ saat ada studi lain → pemilik memilih ★ baru (default terbaru).
- **Cek Get ready hanya menyarankan, tidak pernah mengunci**: *Start anyway* selalu ada; toleran (wajah agak di pinggir, 40–80 cm, cahaya dari jendela belakang).
- **Kalibrasi eye tracking**: layar Get ready + titik otomatis (tanpa klik); label good ≤150 px / okay ≤250 px / poor; satu kali saran ulang. Diagnostik hanya lewat `?vibe_gaze_debug=1` (tim), lokal, tanpa video/gambar.

---

## 4. Log perubahan (terbaru di atas)

### 27 Nov 2026 — siap pindah ke Cloudflare Pages
- Build sekarang juga menulis `dist/_headers` dan `dist/_redirects` (format Cloudflare Pages) dari `vercel.json` lewat `scripts/cloudflare-config.mjs`. `vercel.json` tetap satu-satunya tempat mengedit header/CSP/redirect; Vercel tetap berjalan seperti biasa.
- Panduan migrasi: lihat pesan di chat 27 Nov (ringkas: buat project Pages dari GitHub, build `npm run install:all && npm run build`, output `dist`, env `NODE_VERSION=22` + semua `VITE_*`, preview branch = none, tes di `*.pages.dev`, lalu pindah DNS).
- **Belum diverifikasi di Cloudflare**: header `/embed/*` (CSP harus hilang) dan `/embed/session.html` (CSP khususnya). Cek dengan `curl -I` setelah deploy pertama.

### 2 Des 2026 (b) — tombol "Start calibration" mati, laporan per peserta, skala, satu studi per modul, tab Participant paths
**Akar masalah tombol mati (bug #1)**
1. **Versi `gaze.js` tidak cocok dengan widget.** `gaze.js` dimuat dari alamat tetap (`/embed/gaze.js`) dengan cache `max-age=300, stale-while-revalidate=86400`, sedangkan `vibe-app.js` di-cache terpisah. Setelah deploy 2 Des, browser bisa memakai widget baru dengan `gaze.js` lama yang **belum punya** `precheck()`/`detect()`. Akibatnya setiap tick pre-check melempar error sebelum `setIssues` → `issues` tetap `null`.
2. **Tampilan menunjukkan ✓ padahal belum ada hasil.** Saat `issues === null`, ketiga baris tetap merender ikon ✓ + teks "Face in the middle / About an arm’s length / Enough light" (hanya warnanya netral), sementara tombol `disabled={!issues || …}` dan *Start anyway* hanya muncul kalau ada masalah. Jadi persis yang Anda lihat: ✓✓✓, tombol pudar, tidak ada jalan keluar. (Kode lama, `Research.tsx`: `has()` mengembalikan `undefined` → cabang ✓.)
3. **Timer 600 ms direset oleh satu frame jelek** (wajah hilang satu frame, kecerahan/jarak di dekat batas) — dengan webcam asli ini sering. Ditambah batas sempit: jarak dari ukuran iris mengasumsikan kamera 60°, sehingga kamera laptop lebar (±78°) di 60 cm terbaca "terlalu jauh"; kecerahan rata-rata seluruh gambar → jendela di belakang = "bright".

**Perbaikan**
- `gaze.js?v=<build>`: widget selalu memuat `gaze.js` dari build yang sama (`VITE_BUILD_ID`, `app.tsx` `gazeHref`).
- Logika cek pindah ke widget sendiri (`PrecheckGate` di `gaze-model.ts`, murni, dites): baris dan tombol membaca **daftar yang sama**; masalah baru tampil kalau ada di 3 dari 5 frame terakhir (satu frame jelek tidak mereset); tombol aktif setelah 300 ms hijau. Belum diketahui → "… Checking", bukan ✓. Setiap bagian tick dibungkus try/catch; `gaze.js` lama tanpa `detect()` tetap jalan.
- Batas toleran: wajah 0,28–0,72 (x) / 0,18–0,80 (y); terlalu dekat hanya ≤35 cm (kamera 60°), terlalu jauh hanya ≥90 cm (kamera 78°); cahaya dari bagian tengah gambar (wajah), gelap <30, silau >248.
- **Start anyway** selalu tampil (link).
- Titik: stabil diukur terhadap noise titik itu sendiri (MAD), batas waktu 2,5 dtk tetap mengambil frame yang ada; klik titik = langsung selesai; titik tanpa wajah diulang sekali lalu dilewati; 3 titik berturut-turut tanpa wajah atau <6 titik terlihat → layar hasil "We couldn’t see your eyes well enough" (Try again / keluar). Tidak ada layar tanpa jalan maju dan keluar.
- **Laporan per peserta**: menu **Show** (All participants / satu peserta) berlaku untuk seluruh laporan; **Participants list** (Participant 1, 2… urut mulai, tanggal, perangkat, kalibrasi + grade, halaman, durasi; nama reviewer kalau reviewer, tanpa email; maks 200 baris di daftar, semua di menu); per peserta: urutan halaman + waktu, "Look, then click" (gaze di elemen yang sama atau ≤120 px dalam 5 dtk sebelum klik), gaze per halaman di snapshot. Hanya di panel. Bandingkan dua peserta: **belum dibuat** (tidak murah dengan tata letak sekarang).
- **Skala**: tabel halaman dengan pencarian, sortir, 25 baris per halaman (`pageTable`); detail tetap di samping/bawah; ringkasan satu baris. Data tetap dibatasi: 1.000 run, 20.000 event (`paged()`), nama reviewer maks 300.
- **Satu studi per modul**: migrasi `20261202000000_studies_guard.sql` (trigger `study_delete_guard` + `study_after_delete`, fungsi `delete_study(p_study, p_new_default)`); panel: tombol hapus redup + tooltip, dialog memilih ★ baru. Hapus proyek/workspace tidak pernah diblokir. Modul yang dinyalakan lagi mendapat ★ lewat jalur idempoten yang sudah ada.
- **Tab Participant paths**: dulu `setTab` membuang `?module=` → halaman semua modul. Sekarang `?module=gaze&tab=sessions` (tab hanya sesi modul itu), `activeOf` (dipindah ke `src/saas/nav-active.ts`) tetap menyalakan link modul.
- Tes: `tests/gaze-precheck.test.ts` (7, landmark sintetis bernoise), `tests/nav.test.ts` (3, semua tab modul), `gaze-report.test.ts` +2, `supabase/tests/studies_guard_test.sql` (16 cek; seluruh `run.sh` lulus; file catch-up diuji 2× di DB dari semua migrasi sebelumnya), e2e `tests/e2e/gaze-precheck-flow.mjs` (kamera palsu Chromium + fitur mata sintetis lewat route: Get ready → 13 titik → 5 validasi → hasil tanpa klik selain Start, ±20 dtk; jalur tanpa wajah ±16 dtk), `gaze-calib-report.mjs` (+5 cek per peserta/cari), `camera-runs.mjs` ALL PASS.

**Yang harus dilakukan pemilik**
1. Jalankan `apps/saas/supabase/catch-up/2026-12-02-studies-guard.sql` (setelah `2026-12-01-snapshots-layouts.sql`). Sebelum dijalankan, panel kembali ke hapus biasa (tanpa penjaga di server, tanpa memilih ★ baru).
2. Tes ulang di laptop Anda: `docs/TESTING.md` 9.23–9.29. Setelah deploy, muat ulang halaman situs dengan cache dikosongkan sekali (Ctrl+Shift+R) agar widget baru terpakai.

**Belum terverifikasi**
- Webcam asli Anda (penyebab #1 dibuktikan dari kode + cache header, tidak dari perangkat Anda); e2e memakai fitur mata sintetis, bukan model wajah.
- Batas jarak memakai asumsi sudut kamera (60°/78°); kamera sangat lebar/sempit bisa sedikit meleset (hanya saran, tidak mengunci).
- Nama reviewer di laporan membutuhkan kolom `runs.source` & `reviewers.visitor` (sudah ada sejak SQL 2026-11-29); kalau gagal dibaca, laporan tetap jalan tanpa nama.
- Dengan >20.000 event per studi, laporan hanya memakai 20.000 event pertama per urutan run (batas lama).

### 2 Des 2026 — eye tracking: akurasi kalibrasi, layar persiapan, cek kepala, laporan ringkas
**Penyebab yang ditemukan (dengan bukti, `apps/saas/tests/gaze-calib.test.ts`, simulator webcam realistis `tests/gaze-sim.ts`)**
1. **Frame dibaca setelah klik (penyebab terbesar).** Dulu titik diklik, lalu 1 detik frame dibaca *sesudah* klik. Sekitar separuh orang sudah memindahkan mata mencari titik berikutnya → model belajar titik yang salah. Simulasi: 163 px → 49 px hanya dengan memperbaiki cara mengambil sampel (model sama).
2. **Model terlalu besar untuk 13 titik + fitur kepala dibagi noise-nya sendiri.** Polinomial 22 suku pada 13 titik; fitur kepala yang hampir diam saat kalibrasi distandarkan dengan noise landmark-nya sendiri, jadi gerakan kepala biasa saat browsing = 10–50× → titik terlempar. Saat browsing (kepala bergerak normal): 562 px → 209 px. Sekarang 4 kandidat model (paling sederhana dulu), dipilih otomatis lewat error leave-one-dot-out, lambda 0,03–1000, batas bawah standar fitur kepala, suku kepala dijepit ±3. Hampir selalu terpilih model mata + kepala linear (`eye1h`).
3. **Bingkai koordinat.** Target dulu `x × window.innerWidth` (termasuk lebar scrollbar; salah total kalau halaman punya `transform`/zoom pada induk). Sekarang target = pusat titik di layar (`getBoundingClientRect`), bingkai yang sama dengan klik dan titik gaze. Scrollbar 15 px hampir tidak berpengaruh; bingkai yang meleset 300 px menambah ±95 px.
4. **Bukan penyebab:** video tercermin (model mempelajari tandanya sendiri: 47 vs 37 px), devicePixelRatio (semua dalam px CSS).
5. **"Move back…" terus muncul:** batas tetap (10°, 4 cm, 15%) + baseline rata-rata + noise pose MediaPipe. Dari kode saja **tidak bisa direproduksi** dengan kepala diam di simulasi; kemungkinan ada selisih tetap antara pose kalibrasi dan saat browsing (mis. bersandar). Sekarang toleransi adaptif dan diagnostik tersedia (lihat bawah).
6. **Laporan "1 person" di setiap ubin:** halaman dipecah per layout (setiap kunjungan bisa jadi layout sendiri kalau sidik halamannya berbeda) dan varian `/product/123` vs `/product/:id` tidak digabung → daftar panjang, tiap ubin 1 orang.

**Yang berubah**
- **Layar persiapan "Get ready"** setelah kamera menyala: pratinjau kecil tercermin (canvas di dialog, lokal, tidak disimpan/dikirim), cek langsung: wajah di tengah, jarak ±1 lengan (ukuran iris), cahaya (kecerahan); tips kacamata dan "keep your head still, move only your eyes". *Start calibration* aktif setelah semua hijau; *Start anyway* tersedia.
- **Kalibrasi otomatis**: titik muncul besar lalu mengecil; frame dibaca sejak titik tampil, 450 ms pertama dibuang, titik pindah sendiri setelah ≥15 frame tenang (atau 3,2 dtk). Klik opsional. 13 + 5 titik.
- **Hasil**: good ≤150 px, okay ≤250 px, poor di atas (sebelumnya 120/220 dan derajat), dengan panduan jelas; poor → saran **Calibrate again** satu kali saja. Laporan panel memakai batas yang sama (150 px).
- **Diagnostik tim**: tambahkan `?vibe_gaze_debug=1` di alamat halaman → tombol **Download diagnostics** di hasil (fitur + posisi titik, tanpa video/gambar, disimpan di komputer Anda). `node apps/saas/tests/gaze-replay.ts <file>` menghitung ulang model lama vs baru dari data Anda. Dengan flag yang sama, konsol mencetak drift kepala tiap 5 dtk saat merekam.
- **Cek kepala baru** (`HeadCheck`): baseline = median pose saat kalibrasi; toleransi = yang lebih besar dari batas model (±15°, geser 12%, jarak 20%) dan 2,5× sebaran saat kalibrasi; pesan baru muncul setelah >2 dtk terus-menerus di luar, hilang setelah 0,6 dtk kembali; saat wajah tidak terlihat: "We can’t see your face" (tidak pernah pesan kepala).
- **Laporan eye tracking**: baris ringkasan; tabel halaman (thumbnail kecil, path, orang, fiksasi, elemen paling dilihat) dengan sortir; panel detail di samping (desktop) / di bawah (HP). Satu baris per halaman; layout = tab di detail (tidak dicampur); orang dihitung unik lintas layout. Kunci halaman memakai aturan yang sama dengan script (`src/core/embed/pages.ts`): id di bawah level atas jadi `:id`; halaman level atas tidak lagi jadi `/:id` hanya karena slug berangka (kecuali UUID/hex panjang/angka ≥5 digit). Snapshot OFF → kartu "Turn on page snapshots to see the page here" + tombol satu klik (setting yang sama di Settings, teks privasi sama); ON tapi belum ada gambar → "The next visit will save a picture of this page".
- Tes: `npm run test:gaze` (di `apps/saas`): `gaze.test.ts`, `gaze-calib.test.ts` (9 tes), `gaze-report.test.ts` (3 tes); e2e `tests/e2e/gaze-calib-report.mjs` (ALL PASS, kamera palsu). Tidak ada SQL baru.

**Yang harus dilakukan pemilik**
1. Tidak ada SQL, secret atau setting baru. Deploy = push ke main (sudah).
2. Tes dengan webcam Anda (`docs/TESTING.md` 9.11f, 9.11f-2, 9.11f-3, 14c): buka link studi Eye tracking dengan `?vibe_gaze_debug=1`, ikuti Get ready, kalibrasi, lalu **Download diagnostics** dan jalankan `node apps/saas/tests/gaze-replay.ts <file>`. Kirim angka v2 → v3 dan baris "head pose spread" ke developer.
3. Kalau laporan masih menunjukkan banyak tab layout untuk satu halaman: catat halamannya — artinya sidik layout halaman itu berubah antar kunjungan (konten dinamis), perlu disesuaikan terpisah.

**Belum terverifikasi**
- Akurasi webcam asli: angka di atas dari simulasi. Target realistis 100–200 px; belum diukur di laptop Anda.
- Penyebab pasti "Move back…" di laptop Anda (belum bisa direproduksi dari kode); toleransi baru jauh lebih longgar dan adaptif, diagnostik di konsol akan menunjukkannya.
- Cek cahaya hanya kecerahan rata-rata (lampu dari belakang yang tetap terang rata-rata tidak terdeteksi); silau kacamata hanya tips, tidak dideteksi.
- Konsol riset (`#/console/gaze`) memakai model baru dan batas baru, tapi belum mendapat layar Get ready/titik otomatis (masih klik).
- Model lama yang tersimpan di run yang sedang berjalan tetap memprediksi seperti dulu (tanpa jepit), sampai kalibrasi baru.

### 1 Des 2026 — eye tracking wajib kamera, kamera bisa dipakai berulang, versi layout, snapshot halaman
**Yang berubah**
- **Bug eye tracking tanpa kamera (diperbaiki)**: di studi Eye tracking, "No, go on without" dulu meneruskan run tanpa gaze. Sekarang tombolnya "No thanks" (label "Needed for this study"); menolak, kamera tidak ada/ditolak, atau berhenti saat kalibrasi → pesan jujur + "Back to the site", run dihapus (`discard_run`). Di server `finish_run` menandai run modul gaze tanpa gaze `excluded`; heatmap, ringkasan, laporan gaze dan hasil studi mengabaikannya. Usability/5-detik dengan eye tracking tambahan: "Continue the test without eye tracking".
- **Bug kamera hanya jalan ±2 kali (diperbaiki)**: `<video>` tersembunyi kini di satu wadah tetap di shadow root; setiap mulai menghentikan stream lama lalu meminta kamera baru (timeout 15 dtk, pesan untuk NotReadable "Your camera is being used by another app or tab", Abort, Timeout, play() gagal); kamera dimatikan saat unmount, tolak, selesai, `pagehide`/`beforeunload`; timestamp MediaPipe selalu naik antar run; landmarker yang error ditutup dan dibuat ulang. Sama di konsol (`GazeRunner.tsx`, `engine.ts`, `gaze-model.ts`).
- **Versi layout**: widget menghitung sidik struktur halaman (tag, landmark, atribut stabil, jumlah; tanpa teks). Kemiripan < 0,8 = layout baru. Setiap event membawa hash layout. Panel memisah hasil per halaman+layout: "Layout changed on … — results split into before/after" + Compare; overlay di situs hanya menampilkan layout terbaru.
- **Snapshot halaman**: sekali per (proyek, halaman, layout, perangkat) dari browser tim/reviewer/peserta link: DOM disalin + gaya, disamarkan (field kosong, `data-private`/frame situs lain abu-abu, email/nomor diganti), digambar ke WebP/JPEG ≤ 1280 px lebar, ≤ 4000 px tinggi, ≤ 580 KB (halaman tes: 7 KB). Disimpan di bucket privat `snapshots` (satu path per klaim, rate limit 5/jam/orang); panel membaca lewat signed URL. Heatmap klik dan laporan eye tracking digambar di atas snapshot (titik yang terikat elemen memakai peta kotak elemen); tanpa snapshot → skema abu-abu. Setting baru Settings → *Save page snapshots*.
- Widget app +18 KB (423 KB mentah, 132 KB gzip); loader `vibe.js` tetap 1.558 byte; snippet tidak berubah.
- Tes: `tests/layout.test.ts`, `supabase/tests/snapshots_layouts_test.sql`, e2e `tests/e2e/snapshots-layouts.mjs` dan `camera-runs.mjs` (kamera palsu Chromium, 5× widget + 5× konsol, tidak ada track kamera tersisa).

**Yang harus dilakukan pemilik**
1. Jalankan `2026-12-01-snapshots-layouts.sql` (setelah `2026-11-29-default-studies.sql`). Cek Storage → bucket `snapshots` private. Tidak ada Edge Function baru.
2. Deploy (push ke main sudah). Snippet pelanggan tidak perlu diganti.
3. Proyek lama: kalau mau snapshot, nyalakan *Save page snapshots* di Settings.

**Belum terverifikasi**
- Belum dicoba di Supabase sungguhan: upload ke storage dari widget (policy `can_write_snapshot`), signed URL di panel, `insert into storage.buckets` di SQL editor.
- Kualitas gambar snapshot di situs nyata: font web dan gambar dari CDN lain tidak ikut (kotak abu-abu); Safari menggambar foreignObject secara berbeda (bisa gagal → tidak ada snapshot, hasil tetap tampil di skema).
- Tes kamera ulang memuat ulang halaman di setiap run; mulai-berhenti berkali-kali tanpa reload di halaman yang sama hanya dites secara manual-logika. Model wajah (GPU) di headless tidak diverifikasi; tes memeriksa kamera dan frame.
- Ringkasan heatmap server (`heatmap_summary`) belum dipisah per layout; overlay memakai titik mentah (≤ 20.000) bila layout pernah berubah.
- Membersihkan hasil satu studi tidak menghapus snapshot (snapshot milik proyek); hapus lewat Settings → Data atau mematikan setting.

### 30 Nov 2026 — menu panel, laporan eye tracking, hasil hanya dari dashboard
- **Menu kiri** didesain ulang: Overview · Setup · **Feedback** (Comments, Component reviews, Voice notes, Rounds, Report) · **Research** (All studies, Usability tests, 5-second tests, Heatmaps, Eye tracking, Participant paths) · Reviewers · Settings · User guide. Bug lama: `?module=` diabaikan sehingga 5 item tersorot sekaligus; sekarang **tepat satu** item aktif (halaman hasil studi → "All studies"). Badge jumlah di grup dihapus (tidak berguna). Alamat lama tetap jalan (termasuk `?kind=eyes`).
- **Laporan eye tracking (Labs)** di hasil studi: ringkasan (peserta, % kalibrasi baik ≤150 px dengan rentang 95%, akurasi median, % drift-corrected), daftar halaman dengan pratinjau titik fiksasi (skematik, tidak ada screenshot), per halaman: siapa melihat elemen (± 95%), waktu ke pandangan pertama, lama melihat, kembali lagi, dan berapa yang mengklik; "dilihat pertama" + urutan tiga pertama; catatan "dilihat tapi tidak diklik" hanya untuk tombol/link. Memakai fungsi algoritma yang ada (tidak menulis ulang). Mode demo: Research → Eye tracking → *See a sample report* (data contoh berlabel).
- **View heatmap** (klik atau gaze) dari panel membuka situs dengan overlay **langsung terbuka** pada studi, jenis dan halaman itu (hint `vibe_tool/vibe_heat/vibe_study/vibe_page`, sekali pakai, tetap jalan setelah redirect). Juga berlaku untuk proyek yang hanya menyalakan Eye tracking (sebelumnya gagal karena butuh tool Heatmap).
- **Tombol Heatmap di widget** (tim) tidak lagi menampilkan hasil: isinya status rekam klik, Copy invite link, **Take part in eye tracking**, dan **Open results in your panel**. Hasil hanya dari panel. Pengunjung tetap tidak pernah melihat hasil.
- Tidak ada SQL baru (kolom x, y, vw di `run_events` sudah ada dan sudah bisa dibaca anggota).

**Yang belum terverifikasi:** laporan eye tracking dengan data server asli (hanya diuji dengan data contoh di demo); overlay gaze di server (demo tidak punya data gaze, jadi menampilkan "No eye tracking here yet"); "Take part in eye tracking" di situs asli (butuh studi ★ Eye tracking terbuka). **Cache:** `vibe-app.js` disajikan dengan max-age 300 — setelah deploy, tunggu ±5 menit atau hard-reload sebelum menilai perilaku baru.


### 30 Nov 2026 — Eye tracking webcam v2 (akurasi)
- **Audit pipeline lama**: fitur hanya posisi iris terhadap sudut mata + arah kepala kasar (tanpa kelopak, tanpa roll/jarak); model ridge linear dengan λ tetap 0,5; kalibrasi mengambil frame mulai 150 ms (mata masih mendarat), tanpa buang kedip/lirikan, urutan titik tetap; validasi hanya rata-rata px (tanpa derajat/presisi); kedip dari satu ambang keterbukaan; tidak ada deteksi kepala bergeser; klik dipakai 3× bobot tanpa cek (bisa menyeret model); fiksasi I-DT dengan ambang hanya dari akurasi.
- **Sekarang** (`src/core/gaze-model.ts`, `gaze-analysis.ts`): fitur iris kedua mata dinormalisasi ke sudut + kelopak, eye aspect ratio, yaw/pitch/roll, posisi & jarak kepala; model ridge polinomial derajat 2 + kompensasi pose kepala, λ dipilih cross-validation per sumbu x/y; kalibrasi 13 titik urutan acak, 300 ms pertama dibuang, kedip/lirikan dibuang; validasi 5 titik baru → akurasi px **dan derajat** (jarak layar diperkirakan dari ukuran iris) + presisi RMS-S2S; jika buruk (> ~5,5°) ditawarkan **Five more dots** sekali; saat merekam: kedip dibuang (EAR), sampel saat kepala jauh dari pose kalibrasi dibuang + ajakan "Move back…" setelah 2 dtk; klik hanya mengajari model jika dekat estimasi (bobot 0,5); `requestVideoFrameCallback`; fiksasi hybrid I-VT/I-DT dengan ambang dari presisi terukur.
- **Angka (data sintetis, `node apps/saas/tests/gaze.test.ts`)**: error rata-rata kepala diam **137 → 58 px**, kepala bergerak **268 → 120 px**; kedip 300/300 tertangkap, 0/300 salah buang; fiksasi precision/recall 0,97/0,92 → 1,00/0,95; ~1–2 µs per frame untuk prediksi (deteksi wajah MediaPipe sendiri tidak diukur di Node); fit kalibrasi + CV ~30–60 ms.
- **Kualitas per run disimpan tanpa SQL baru**: konsol di `GazeSession` (accuracyDeg, precision, distance, loss, head, msPerFrame — field opsional); widget di `runs.result.gaze` (jsonb yang sudah ada). Aturan "leave out" heatmap tetap 220 px tapi kini jelas berdasarkan cek akurasi. Model lama yang tersimpan tetap bisa dipakai.
- Loader `vibe.js` tidak berubah; semua kode gaze tetap di `embed/gaze.js` yang dimuat hanya saat eye tracking dimulai. `apps/content` tidak diubah. Halaman hasil eye tracking (Nav/Research) tidak disentuh — dikerjakan agen lain.
- **Tidak perlu SQL.**
- **Belum diverifikasi**: webcam asli (berbagai kamera, kacamata, cahaya redup/dari belakang), akurasi nyata dalam derajat, perkiraan jarak dari iris (bergantung FOV kamera), ms/frame MediaPipe di laptop lemah, Safari (tanpa `requestVideoFrameCallback` di versi lama → fallback rAF). Tes manual: `docs/TESTING.md` 9.11e–f.

### 29 Nov 2026
- **Satu studi default ★ per modul riset.** Heatmap, Eye tracking, 5-second test dan Usability test masing-masing otomatis punya satu studi default (badge **★ Default · Auto**) saat modul dinyalakan (onboarding atau Update site); proyek lama mendapatkannya lewat SQL untuk modul yang sudah aktif. Indeks unik per (proyek, modul), pembuatan idempoten.
- **Halaman Research disusun per modul**: tiap bagian menampilkan ★ di atas, link, Results, Pause/Resume, Edit (Edit tasks untuk usability), **★ Make default** pada studi lain, dan satu tombol **Add another study** per modul. Link sidebar `?module=…` (link lama `?kind=…` tetap jalan).
- **Tombol "New study" dihapus/dialihkan**: (1) header Research, (2) kartu kosong "No studies yet" di Research, (3) teks kosong filter ("Make one with New study…"), (4) Dashboard "No studies yet. Make one" → "Open Research", (5) Guide "press New study" → Add another study. Tidak ada tempat lain yang membuat studi (widget, Products, onboarding, konsol tidak membuat studi di panel hosted).
- **Audiens Everyone**: pengunjung melihat **semua** modul yang aktif (bukan hanya Comment). Modul riset bertanya satu kalimat, mis. *"Your clicks on this site will be recorded for the site owner's heatmap. [OK] [No thanks]"*; eye tracking: izin kamera + kalibrasi; 5-second: tesnya; usability: tugas dari studi ★. Tanpa kolom nama. Rekaman baru mulai setelah OK, masuk ke studi ★ modul itu. Pengunjung **tidak pernah** melihat hasil (dipaksa di server). Modul yang dipause disembunyikan untuk pengunjung; modul yang tidak bisa jalan tampil dengan alasan singkat.
- **Server** (`migrations/20261129000000_default_studies.sql`): kolom `studies.module`, `make_default_study`, `visitor_modules` (boleh anon, hanya nama/status), `start_visitor_run` (origin, modul aktif, ★ terbuka, rate limit per sesi / alamat / proyek, maks 2.000 run pengunjung per studi per hari), `module_study_invite`, `reviewers.visitor` (pengunjung yang hanya bergabung ke widget terbuka tidak bisa membaca heatmap/link undangan), `runs.source = 'visitor'`, indeks per proyek/modul.
- **Tanpa dampak ke instalasi lama**: snippet sama, audiens tidak diubah, studi/link/data lama tetap; config lama tetap terbaca. Tes: `supabase/tests/default_studies_test.sql` (36 cek, termasuk instalasi lama, link studi lama, audiens tetap), `npm run test:compat` di `apps/saas` (10 cek config lama + keputusan widget), semua tes SQL lama tetap ALL PASS; catch-up dites pada DB dari semua migrasi lama (termasuk 2026-11-28) dengan data, dijalankan dua kali.
- **Demo (tanpa server)** tetap jalan: studi ★ per modul di penyimpanan browser (`localheat.ts`), Pause dari panel demo, contoh heatmap berlabel tetap sampai ada data asli. Playwright: `apps/saas/tests/e2e/default-studies.mjs` (onboarding Heatmap+5-second+Usability → Everyone → pengunjung melihat semua modul → OK → klik tercatat → tanpa hasil; tim melihat klik pengunjung; pause menyembunyikan modul; proyek "lama" sama seperti sebelumnya; tidak ada "New study").
- Privacy (Legal.tsx), Guide, teks Widget (Everyone) dan README diperbarui. PostHog: `study_added`, `study_default_changed`.
- **Perlu SQL** `2026-11-29-default-studies.sql` (setelah `2026-11-28-demo-origin.sql`). Sebelum SQL dijalankan: panel tetap jalan (membaca tanpa kolom baru), tombol riset pengunjung tampil "unavailable right now".
- **Belum diverifikasi**: di Supabase live; tampilan HP; eye tracking pengunjung dengan kamera asli; beban/rate limit dengan lalu lintas nyata (header `x-forwarded-for` di Supabase dianggap ada; tanpa itu batas per alamat dilewati dan batas per proyek berlaku); pengunjung yang bergabung ke widget Everyone **sebelum** SQL ini tetap tercatat sebagai reviewer biasa (bisa membaca heatmap) sampai dihapus dari Reviewers.

### 28 Nov 2026
- **Bug demo di ourhunch.com**: link review di `ourhunch.com/embed-demo.html` ditolak ("This review link doesn't work on this address") karena daftar situs demo masih berisi alamat lama `whatvibecodingcando.vercel.app`. Perbaikan: `catch-up/2026-11-28-demo-origin.sql` (menambah `https://ourhunch.com` dan `www`).
- **Perbaikan email hari ke-7**: studi otomatis "Site heatmap" tidak lagi dihitung sebagai studi buatan pengguna, jadi email *"Test with real users"* tetap terkirim. Sudah termasuk di `2026-11-28-default-heatmap.sql` (diuji dua kali di database lokal, semua tes SQL lulus).
- **Heatmap langsung jalan tanpa membuat studi.** Saat Heatmaps dinyalakan (onboarding atau Products → Update site), server otomatis membuat satu studi **Site heatmap** (Heatmap visit, tanpa tanggal akhir, semua halaman) — tidak pernah dobel; proyek lama yang Heatmaps-nya aktif ikut dibuatkan oleh SQL. Tampil di Research dengan label "default"; bisa diganti nama, ditutup (pause), atau dihapus.
- **Klik reviewer & tim tercatat otomatis** (lewat link review atau Open my site) ke studi itu, satu "run" per sesi reviewer, dengan aturan rekaman yang sama (hanya klik asli, batas jumlah, tanpa isi field/ketikan). Widget menampilkan sekali: "Your clicks on this site help build its heatmap…" + tombol mati; di panel Heatmap ada centang **Record my clicks for this heatmap**. Server memeriksa origin, status reviewer dan rate limit.
- **Panel Heatmap di widget**: tombol utama **Copy invite link** (link peserta → layar persetujuan → jelajah), **Share on WhatsApp**, "N people so far", link kecil "More options in your panel". Tulisan lama "Start a study" diganti. Heatmap menyegarkan diri tiap 10 detik selama tab terlihat. Halaman demo tetap menampilkan "Sample data" sampai ada klik asli.
- **Perbedaan dua heatmap dijelaskan**: di bawah tab Clicks / Where people looked ada satu kalimat + tombol "What's the difference?" (tabel: sumber data, yang dipelajari, kebutuhan, akurasi). Kartu produk onboarding & Products: Heatmaps "Where people click — fills automatically"; Eye tracking (Labs) "Where people look — needs their webcam and consent". Pratinjau dan teks website disesuaikan. Guide: bagian "Click heatmap vs eye-tracking heatmap".
- **Privacy** diperbarui: klik reviewer/tim kini direkam secara default (bagian 3 & ringkasan), bisa dimatikan.
- Demo tanpa server: data heatmap & link undangan disimpan di browser situs (`localheat.ts`), jadi alur yang sama bisa dicoba.
- Tes: `supabase/tests/default_heatmap_test.sql` (28 cek: otomatis & tidak dobel, reviewer run, origin, rate limit, anon ditolak, pause, link baru/ dicabut); SQL catch-up dites di DB dari semua migrasi lama, dua kali; Playwright demo `apps/saas/tests/e2e/`.
- **Perlu SQL** `2026-11-28-default-heatmap.sql`. Sebelum SQL dijalankan, widget tidak merekam klik reviewer dan tombol undangan nonaktif (panel tetap jalan).
- **Belum diverifikasi**: di Supabase live; tampilan HP; email "studi" di lifecycle/ops kini menganggap proyek dengan Heatmaps sudah punya studi (angka "studies" di admin ikut naik); token link default disimpan (tabel `study_invites`, hanya service role) agar bisa disalin dari widget.

### 27 Nov 2026
- **Heatmap kosong di situs asli**: panel heatmap sekarang menjelaskan kenapa kosong dan langkah membuat studi, dengan tombol **Start a study** ke panel (sebelumnya hanya "No eye tracking on this page yet").
- **Heatmap di halaman demo**: menampilkan contoh data berlabel "Sample data" (sebelumnya error "Open the site through a review link").
- **Alur instalasi diperbaiki** (masalah: daftar → salin script → pasang di localhost → widget tidak muncul):
  - Onboarding bertanya *"Where will you add it?"*: alamat lokal (pilihan cepat localhost:3000/5173/8080) dan situs live. Alamat langsung disimpan dan widget **otomatis dipublikasikan**.
  - Langkah pasang: snippet + checklist ① tempel sebelum `</body>` ② **Open my site** (token tim) ③ "Visitors won't see anything".
  - Cek instalasi otomatis ("Waiting for your site…" → "✓ Installed on localhost:3000"); setelah 2 menit muncul kartu bantuan (snippet, `data-project`, host CSP yang perlu diizinkan, ad-blocker).
  - Tips sekali tampil di widget saat dibuka dari panel; banner "ourhunch saw your script on localhost:3001 — Add it".
  - Laporan pertama tiap browser selalu dikirim (dulu hanya 5%), supaya cek instalasi tidak meleset.
  - **Perlu SQL** `2026-11-27-install-flow.sql`. Belum diuji di Supabase live, belum dicek tampilan HP.
- Dokumen ini dibuat; aturan "selalu tulis handoff" ditambahkan ke `CLAUDE.md` dan `AGENTS.md`.

### 26 Nov 2026
- Audit keamanan: tidak ada temuan kritis/tinggi; CSP lengkap, hak akses berlebih dicabut, build tanpa console/debugger (`docs/SECURITY-AUDIT-2026-11.md`).
- Logika pembayaran Paddle siap, mati secara default (`docs/BILLING.md`).
- Privacy Policy & Terms ditulis ulang (placeholder di `docs/LEGAL-TODO.md`).
- Heatmap v4: normalisasi paparan, semua klik lewat ringkasan server, rentang keyakinan, koreksi pergeseran eye tracking.

### 25 Nov 2026
- Login kode email (OTP), toko demo dihapus dari `/app#`, admin: status widget per pengguna, PostHog taksonomi event, video preview produk, perbaikan onboarding (produk terpilih muncul di demo), heatmap v3, sistem email lengkap (aktivitas, onboarding, mingguan, template Auth).

### Sebelumnya (ringkas)
- Rebrand ke ourhunch, domain ourhunch.com, Google login, admin panel, review rounds + approval, pin tahan deploy, harga $4.80/$2, riset fitur & kompetitor (`reports/`).

---

## 5. Cara memeriksa cepat

1. `https://ourhunch.com/` dan `/app` terbuka; `/app#/admin` menampilkan "Ops sign-in".
2. Panel → Install → **Open my site** → widget muncul di situs Anda.
3. Komentar sebagai reviewer → email notifikasi ≤ 5 menit.
4. Daftar akun baru → kode email → onboarding → email welcome ≤ 5 menit.
5. Daftar lengkap: `docs/TESTING.md`.
