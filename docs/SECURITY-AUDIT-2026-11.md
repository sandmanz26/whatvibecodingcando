# Audit keamanan — November 2026

*Tanggal: 25–26 November 2026. Cakupan: database Supabase (semua migrasi), probing live (hanya baca, proyek kita sendiri, hanya dengan publishable key), aplikasi web (`/`, `/app`, `/content/`), script embed (`/embed/*`), header Vercel, riwayat git, dependensi, dan anti reverse engineering. Tidak ada secret yang dipakai atau diminta.*

## Ringkasan

Tidak ditemukan celah kritis atau tinggi yang bisa dieksploitasi dari luar. Semua tabel memakai row level security, anon tidak bisa membaca satu tabel pun (diuji live: 25 tabel → 401), semua fungsi `security definer` punya `search_path` tetap, tidak ada SQL dinamis, fungsi ops/email menolak anon (diuji live), bucket storage tidak bisa di-list, Edge Function `send-emails` menolak tanpa secret (401), tidak ada secret di riwayat git (117 commit dipindai), `npm audit` bersih di ketiga app. Yang diperbaiki di bawah adalah pertahanan berlapis (defence in depth) dan pengerasan build/header.

## Temuan

| # | Tingkat | Area | Temuan | Status |
|---|---|---|---|---|
| 1 | Sedang | Abuse / auth | Sign-in anonim aktif (dipakai reviewer) dan CAPTCHA Turnstile belum dipasang di produksi: siapa pun bisa membuat sesi anonim massal (spam komentar tetap dibatasi asal-situs dan rate limit SQL). | **Aksi owner** (Turnstile) |
| 2 | Sedang | Repositori | Repositori GitHub publik: semua kode, SQL dan dokumen bisnis bisa dibaca. | **Aksi owner** |
| 3 | Rendah | Database | Role `anon`/`authenticated` punya hak `TRUNCATE`, `TRIGGER`, `REFERENCES` di tabel publik. `TRUNCATE` mengabaikan RLS. Tidak terekspos lewat REST API, tapi tidak boleh ada. | **Diperbaiki** (migrasi + catch-up + tes) |
| 4 | Rendah | Database | Fungsi trigger `add_owner()` dan `projects_fixed()` bisa dieksekusi `anon` (lewat grant default ke `public`). Tidak bisa dipanggil sebagai RPC biasa, tapi tetap dicabut. | **Diperbaiki** |
| 5 | Rendah | Database | Default privileges: tabel/fungsi baru di masa depan otomatis diberikan ke `anon`; setiap migrasi harus ingat mencabutnya. | **Diperbaiki** (default privileges dicabut) |
| 6 | Rendah | Web / header | CSP hanya `frame-ancestors`/`base-uri`/`object-src`/`form-action`; tidak ada `script-src`, `connect-src` dsb. Halaman sesi `/embed/session.html` tanpa CSP. | **Diperbaiki** (CSP lengkap, script inline lewat hash, cek otomatis saat build) |
| 7 | Rendah | Web / XSS | `href` alamat situs di Dashboard dan link reviewer dibangun dari data; database sudah membatasi ke `http(s)://`, tapi klien belum memeriksa. | **Diperbaiki** (`safeHttpUrl`, cek protokol di `openAsReviewer`) |
| 8 | Rendah | Reverse engineering | Build belum membuang `console.log`/`debugger`/banner lisensi; nama chunk lazy (mis. `Ops-….js`) memetakan struktur app; config content belum menulis `sourcemap: false` secara eksplisit. | **Diperbaiki** |
| 9 | Rendah | Repositori | `.gitignore` tidak menutup file `.env*`, kunci `*.pem`, `.vercel`, `supabase/.temp`. | **Diperbaiki** |
| 10 | Info | API | PostgREST memberi petunjuk nama fungsi (PGRST202) ke anon. Nama fungsi bukan rahasia; setiap fungsi memeriksa pemanggil. | Risiko diterima |
| 11 | Info | Database | Anggota workspace boleh mengubah semua kolom komentar/proyek di workspace-nya (RLS per workspace, bukan per penulis). Sesuai model tim. | Risiko diterima |
| 12 | Info | Embed | Iframe sesi (`/embed/session.html`) bisa disematkan situs mana pun dan memberi sesi anonim per-origin; komentar tetap ditolak kecuali origin terdaftar di proyek. | Risiko diterima (desain) |
| 13 | Info | Reverse engineering | Kode klien selalu bisa dibaca. Obfuskasi widget tidak dipasang: `vibe-app.js` 358 kB sudah diminify+mangle; obfuskator menambah ukuran 1,5–3× dan memperlambat situs pelanggan. | Risiko diterima |
| 14 | Info | Supabase | Backup harian hanya di paket Pro; tanpa itu tidak ada point-in-time recovery. | **Aksi owner** |

## Yang sudah diperbaiki

- **Database** — `apps/saas/supabase/migrations/20261126120000_security_hardening.sql`, satu kali tempel: `apps/saas/supabase/catch-up/2026-11-26-security.sql` (begin/commit, aman dijalankan berulang; diuji di database yang dibangun dari semua migrasi sebelumnya). Tes baru `tests/security_hardening_test.sql` memeriksa: tidak ada TRUNCATE/TRIGGER/REFERENCES untuk role API, anon tanpa hak tabel, fungsi trigger tidak bisa dipanggil, setiap `security definer` punya `search_path`, setiap tabel ber-RLS, dan hanya `get_share`, `report_seen`, `study_info` yang terbuka untuk anon. `tests/run.sh` lulus.
- **Header (`vercel.json`)** — CSP penuh untuk semua halaman kita: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'` + hash SHA-256 setiap script inline + Turnstile + aset PostHog; `connect-src` hanya Supabase proyek kita, PostHog, model MediaPipe; `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`. CSP ketat terpisah untuk `/embed/session.html` (`default-src 'none'`). `X-Robots-Tag: noindex` untuk `/app` dan halaman sesi, `Permissions-Policy` lebih lengkap, `X-Permitted-Cross-Domain-Policies: none`. Header `/embed/*` (CORS `*`, CORP cross-origin) tetap, karena script dimuat di situs pelanggan.
- **Cek CSP otomatis** — `scripts/check-csp.mjs` dijalankan di akhir `npm run build`: build gagal jika ada script inline yang hash-nya tidak ada di `vercel.json` (mencegah CSP diam-diam memblokir halaman).
- **Build** — semua config Vite: `sourcemap: false`, `esbuild.drop: ['debugger']`, `console.log/debug/info` dibuang, `legalComments: 'none'`; chunk lazy di `/app` diberi nama hash saja.
- **Klien** — `apps/saas/src/saas/safe-url.ts` (`safeHttpUrl`) dipakai untuk alamat situs di Dashboard; `openAsReviewer` menolak alamat non-http(s).
- **`.gitignore`** — `.env`, `.env.*` (kecuali `.env.example`), `*.pem`, `*.key`, `.vercel`, `supabase/.temp`, `supabase/.branches`.
- **Verifikasi** — `npm run typecheck && npm run build` lulus; Playwright dengan header `vercel.json` di server lokal: `/`, `/app`, `/app#/app/login`, `/app#/admin`, `/app#/shop`, `/embed-demo.html` (widget muncul di shadow root), `/content/`, `/embed/session.html` — nol pelanggaran CSP, nol error halaman.

## Hasil probing live (hanya baca)

- 25 tabel lewat REST dengan publishable key: semuanya 401.
- `/rest/v1/` (daftar OpenAPI): ditolak ("Secret API key required").
- RPC: `list_threads`, `project_stats`, `delete_my_account`, `ops_users`, `ops_overview`, `email_lifecycle_due` → `permission denied`; `get_share`/`study_info` dengan token salah → `share_unavailable`/`no_project`.
- `/auth/v1/settings`: email + Google + anonim aktif, `mailer_autoconfirm` mati (email harus dikonfirmasi).
- Storage: daftar bucket kosong untuk anon; listing `widget-config` dan `narrations` kosong.
- Edge Function `send-emails` tanpa secret → 401.
- Tidak ada file `.map` di produksi.

## Yang harus dilakukan owner

1. **Jalankan** `apps/saas/supabase/catch-up/2026-11-26-security.sql` di Supabase → SQL Editor (satu kali tempel).
2. **Jadikan repositori GitHub private** (Settings → General → Danger Zone).
3. **Pasang Turnstile** (CAPTCHA) untuk sign-up dan sesi anonim — `apps/saas/supabase/README.md` langkah 4. Juga cek Supabase → Auth → Rate Limits (sign-in anonim per jam).
4. **2FA di mana-mana**: GitHub, Vercel, Supabase, Resend, PostHog, Cloudflare, registrar domain, email owner.
5. **Supabase Pro** untuk backup harian / point-in-time recovery sebelum ada pelanggan berbayar.
6. **Rotasi kunci** yang pernah ditempel di chat, screenshot atau commit (pemindaian riwayat git tidak menemukan secret, tapi chat/screenshot tidak bisa dipindai).
7. Opsional: GitHub secret scanning + Dependabot; kirim domain ke HSTS preload list setelah yakin semua subdomain HTTPS.
8. Jika proyek Supabase atau host PostHog diganti, perbarui `connect-src`/`media-src` di `vercel.json`.

## Batas yang jujur

- Kode di browser selalu bisa dibaca dan disalin. Minify, mangle dan tanpa source map hanya memperlambat. Perlindungan sesungguhnya ada di server (RLS, fungsi SQL yang memeriksa pemanggil, origin dan rate limit).
- CSP masih mengizinkan `style-src 'unsafe-inline'` (React dan widget memakai atribut style) dan `frame-src https:` (panel menampilkan pratinjau situs pelanggan). Trusted Types belum dipaksakan: PostHog dan MediaPipe belum kompatibel; bisa dicoba nanti dalam mode report-only.
- Audit ini tidak mencakup pengujian penetrasi otomatis skala penuh, kode Edge Function di produksi yang mungkin berbeda dari repositori, atau konfigurasi dashboard Supabase/Vercel yang hanya bisa dilihat owner.
