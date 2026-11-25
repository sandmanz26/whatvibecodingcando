# HANDOFF — status ourhunch (selalu diperbarui)

*Dokumen serah-terima utama. Setiap pekerjaan baru **wajib** menambah catatan di "Log perubahan" dan memperbarui bagian "Yang harus dilakukan pemilik". Ditulis untuk pemilik (Bahasa Indonesia) dan bisa dibaca AI/developer lain.*

Terakhir diperbarui: 27 November 2026

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
| `2026-11-27-install-flow.sql` | alur instalasi baru (kalau ada) | ⬜ |

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
- Heatmap hanya dari peserta studi yang setuju; tidak pernah merekam pengunjung biasa. Eye tracking = Labs (perkiraan).
- Ditahan: "Fixed, please check", error konsol di komentar, MCP.

---

## 4. Log perubahan (terbaru di atas)

### 27 Nov 2026
- **Heatmap kosong di situs asli**: panel heatmap sekarang menjelaskan kenapa kosong dan langkah membuat studi, dengan tombol **Start a study** ke panel (sebelumnya hanya "No eye tracking on this page yet").
- **Heatmap di halaman demo**: menampilkan contoh data berlabel "Sample data" (sebelumnya error "Open the site through a review link").
- **Alur instalasi** (sedang diselesaikan): alamat situs/localhost ditanya saat onboarding dan otomatis dipublikasikan, checklist 3 langkah, cek instalasi otomatis, banner alamat baru. Catatan detail menyusul di sini setelah selesai.
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
