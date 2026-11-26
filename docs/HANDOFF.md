# HANDOFF — status ourhunch (selalu diperbarui)

*Dokumen serah-terima utama. Setiap pekerjaan baru **wajib** menambah catatan di "Log perubahan" dan memperbarui bagian "Yang harus dilakukan pemilik". Ditulis untuk pemilik (Bahasa Indonesia) dan bisa dibaca AI/developer lain.*

Terakhir diperbarui: 30 November 2026

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

---

## 4. Log perubahan (terbaru di atas)

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
