# HANDOFF — status ourhunch (selalu diperbarui)

*Dokumen serah-terima utama. Setiap pekerjaan baru **wajib** menambah catatan di "Log perubahan" dan memperbarui bagian "Yang harus dilakukan pemilik". Ditulis untuk pemilik (Bahasa Indonesia) dan bisa dibaca AI/developer lain.*

Terakhir diperbarui: 28 November 2026

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
- Widget **tersembunyi untuk pengunjung biasa**; hanya tim (lewat "Open my site") dan reviewer (link review) yang melihatnya.
- Heatmap **otomatis**: tiap proyek dengan Heatmaps punya satu studi "Site heatmap" yang selalu terbuka. **Klik reviewer dan tim (Open my site) ikut tercatat secara default**, dengan pemberitahuan sekali dan tombol mati per orang. Orang lain hanya lewat link undangan + layar persetujuan. Pengunjung biasa tetap **tidak pernah** direkam. Eye tracking = Labs (perkiraan).
- **"Collect clicks from all visitors" TIDAK dibuat** (mati, belum diputuskan): butuh notifikasi cookie/persetujuan situs pelanggan, perubahan di loader dan sesi untuk pengunjung anonim — terlalu besar/berisiko untuk sekarang. Kalau mau: pengaturan proyek, teks jujur di panel, dan loader hanya merekam bila situs memberi sinyal persetujuan.
- Eye tracking satu klik (opt-in di widget) **belum dibuat**, menunggu keputusan pemilik.
- Ditahan: "Fixed, please check", error konsol di komentar, MCP.

---

## 4. Log perubahan (terbaru di atas)

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
