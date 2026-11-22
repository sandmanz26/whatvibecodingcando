# Panduan testing manual — Vibe Collab

Untuk dijalankan sendiri, tanpa bantuan AI. Setiap tes punya **langkah** dan **hasil yang diharapkan**. Centang `[x]` kalau lulus; kalau gagal, isi template laporan bug di bagian akhir.

- **Situs produksi:** `https://whatvibecodingcando.vercel.app/` (website) dan `/app` (aplikasi).
- **Bahasa:** tampilan produk berbahasa Inggris; nama tombol di panduan ini ditulis persis seperti di layar.

---

## 0. Persiapan (sekali)

- [ ] **Dua browser berbeda** (mis. Chrome dan Firefox/Safari), atau Chrome biasa + jendela Incognito:
  - Browser A = **pemilik** (Anda, login di panel).
  - Browser B = **reviewer/peserta** (orang lain, tidak login).
- [ ] **Satu HP** (untuk tes tampilan mobile).
- [ ] **Situs uji** dengan snippet terpasang, mis. `https://trms-zeta.vercel.app/` (atau situs lain milik Anda).
- [ ] **Email uji** yang bisa Anda buka (untuk konfirmasi akun & reset password).
- [ ] Akses **Supabase dashboard** (untuk cek data) dan **PostHog** (kalau sudah diaktifkan).
- [ ] Matikan ad blocker saat tes analytics.

**Smoke test cepat (10 menit) setelah setiap deploy:** jalankan tes yang ditandai ⚡.

---

## 1. Website (landing page) — `/`

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 1.1 ⚡ | Buka `/` | Landing page tampil (judul "Vibe Collab — the review layer for AI-built products"), tanpa error | [ ] |
| 1.2 | Scroll sampai bawah, pelan | Film scroll berjalan mulus; semua gambar/video muncul; tidak ada kotak kosong | [ ] |
| 1.3 | Klik **Get started** (tombol utama) | Pindah ke `/app#/app/register` (halaman "Create your account") | [ ] |
| 1.4 | Di bagian toolbox/harga, pilih beberapa tool lalu klik tombol mulai | Alamat berisi `?products=...`; saat onboarding, tool tersebut sudah tercentang | [ ] |
| 1.5 | Klik link **demo** | `/embed-demo.html` terbuka, widget muncul | [ ] |
| 1.6 | Klik **Privacy**, **Terms**, **Guide** di footer | Halaman masing-masing terbuka di `/app#/...` | [ ] |
| 1.7 | Buka `/landing/` | Diarahkan ke `/` | [ ] |
| 1.8 ⚡ | Buka alamat lama `/#/app/login` | Diarahkan ke `/app#/app/login` | [ ] |
| 1.9 | Buka di HP | Tidak ada scroll ke samping; teks terbaca; tombol bisa ditekan | [ ] |

---

## 2. Daftar, login, lupa password — `/app`

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 2.1 ⚡ | Browser A: `/app` → isi nama, email, password (2x) → **Create account** | Mode server: muncul pesan cek email (atau langsung masuk kalau konfirmasi email mati) | [ ] |
| 2.2 | Buka email konfirmasi → klik link | Masuk ke aplikasi, lanjut ke onboarding | [ ] |
| 2.3 | Password lemah (mis. `12345678`) | Ditolak dengan pesan yang jelas | [ ] |
| 2.4 | Log out → **Log in** dengan password salah | Pesan error; tidak masuk | [ ] |
| 2.5 ⚡ | Log in dengan password benar | Masuk ke Overview | [ ] |
| 2.6 | **Forgot password** → email → link reset → password baru | Bisa login dengan password baru | [ ] |
| 2.7 | Buka `/app#/app` saat log out | Diarahkan ke login | [ ] |

---

## 3. Onboarding

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 3.1 | Langkah 1: pilih tool (dikelompokkan Feedback / Research / Design QA) | **Fake doors** tertulis "Coming soon" dan tidak bisa dipilih; **Eye tracking** berlabel "Labs" | [ ] |
| 3.2 | Langkah 2: isi nama proyek | Di bawahnya muncul id proyek (mis. `gagero`) | [ ] |
| 3.3 | Isi "Where is the site online?" dengan `trms-zeta.vercel.app` | Muncul "The widget will show on trms-zeta.vercel.app" | [ ] |
| 3.4 | Isi alamat salah (mis. `abc`) | Pesan contoh format yang benar | [ ] |
| 3.5 | Langkah 3: **Copy snippet** | Snippet berisi `src=".../embed/vibe.js"` dan `data-project="..."` saja | [ ] |
| 3.6 | **Finish** | Masuk ke Overview dengan sambutan "Welcome, ..." | [ ] |

---

## 4. Install & melihat widget di situs sendiri

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 4.1 | Pasang snippet di situs uji (sebelum `</body>`), deploy situsnya | — | [ ] |
| 4.2 ⚡ | Buka situs uji **langsung** (bukan dari panel) | Widget **tidak** muncul (benar: hanya reviewer yang melihat) | [ ] |
| 4.3 ⚡ | Panel → **Setup → Install** → **Open my site** | Tab baru ke situs Anda; **widget muncul** (tombol Comment di pojok) | [ ] |
| 4.4 | Tutup tab, buka situs uji lagi di browser yang sama | Widget tetap muncul (browser ini sekarang reviewer) | [ ] |
| 4.5 | Kembali ke **Install** → **Installation check** | Menampilkan "Script ... loaded on ..." dan "The widget was shown" (bisa butuh beberapa detik) | [ ] |
| 4.6 | Situs yang `redirect` ke `/login` saat dibuka: pakai **Open my site** | Widget tetap muncul setelah redirect | [ ] |

---

## 5. Komentar (reviewer)

Pakai **Browser B**. Buat review link dulu: panel → **Reviewers** → isi nama → **Make link** → salin → buka di Browser B.

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 5.1 ⚡ | Browser B: buka review link | Widget muncul; alamat tidak lagi berisi token | [ ] |
| 5.2 ⚡ | Tekan **Comment** (atau huruf **C**), klik sebuah elemen, tulis, kirim | Pin muncul di elemen; toast "Comment posted" | [ ] |
| 5.3 | Ubah ukuran jendela | Pin tetap menempel di elemen yang sama | [ ] |
| 5.4 | Balas komentar | Balasan tampil di thread | [ ] |
| 5.5 | **Voice note** (ikon mikrofon) → izinkan mikrofon → rekam → kirim | Komentar "Voice" muncul; bisa diputar di panel | [ ] |
| 5.6 | **A vs B** (ikon dua kolom): pilih elemen A lalu B, pilih vonis, kirim | Muncul di panel sebagai "A vs B" | [ ] |
| 5.7 | Ketik di kolom input situs Anda lalu tekan C | Komentar **tidak** dimulai saat sedang mengetik | [ ] |
| 5.8 | Buka review link yang sama di browser ketiga | Link ditolak ("This link doesn’t work") — link sekali pakai | [ ] |
| 5.9 | HP: buka review link, buat komentar | Dock tidak keluar layar; komentar bisa dibuat | [ ] |

---

## 6. Komentar (panel pemilik) — **Results → Comments**

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 6.1 ⚡ | Buka Comments | Komentar dari 5.x muncul (dicek ulang tiap 20 detik) | [ ] |
| 6.2 | Lihat baris di bawah teks komentar | Perangkat: mis. "Chrome 131 · macOS · 1280×800" | [ ] |
| 6.3 | **Set as completed** lalu **Reopen** | Status berubah Completed → Open/Ongoing | [ ] |
| 6.4 | Filter status & cari teks | Daftar tersaring dengan benar | [ ] |
| 6.5 | **Results → Component reviews** / **Voice notes** | Hanya jenis itu yang tampil | [ ] |
| 6.6 | **Copy fix prompt** pada satu komentar, tempel di editor | Prompt berisi halaman, `Element:` (selector), `Seen on:`, tanpa nama reviewer | [ ] |
| 6.7 | **Copy open as AI prompt** | Semua komentar terbuka dalam satu prompt bernomor | [ ] |
| 6.8 | **CSV** | File terunduh; kolom page, kind, version, device, status, author, comment...; buka di Excel tanpa error/rumus aneh | [ ] |
| 6.9 | **Share list** → buat link → buka di Browser B (tidak login) | Daftar komentar tampil read-only | [ ] |
| 6.10 | Cabut (revoke) share link → buka lagi | Link tidak berfungsi | [ ] |
| 6.11 | **Open on site** pada komentar | Halaman situs terbuka di elemen terkait, sebagai reviewer | [ ] |
| 6.12 | Hapus satu komentar (ikon tempat sampah) | Hilang setelah konfirmasi | [ ] |
| 6.13 | Filter lalu **Delete these (n)** | Hanya yang terfilter terhapus | [ ] |

---

## 7. Widget — **Setup → Widget**

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 7.1 | Ubah warna/label tombol | Preview (wireframe abu-abu) langsung berubah; bar bertuliskan perubahan belum di situs | [ ] |
| 7.2 ⚡ | **Update site** → konfirmasi | Toast "Site updated"; bar "Your site is up to date"; situs uji berubah di muatan berikutnya | [ ] |
| 7.3 | **Discard changes** | Kembali ke setelan yang ada di situs | [ ] |
| 7.4 | **History** → **Restore** setelan lama | Situs kembali memakai setelan itu | [ ] |
| 7.5 | **Who sees it → Everyone visiting** → Update site | Widget komentar muncul untuk semua pengunjung situs uji (cek di Incognito) — lalu kembalikan ke **Reviewers only** | [ ] |
| 7.6 | **Widget on** dimatikan → Update site | Widget hilang di situs uji | [ ] |
| 7.7 | **Website**: tambah alamat staging, matikan salah satu | Widget hanya muncul di alamat yang aktif | [ ] |
| 7.8 | **Site version** isi `1.0` → Update site → buat komentar baru | Komentar baru membawa versi `1.0` (terlihat di panel/CSV) | [ ] |

---

## 8. Products & Overview

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 8.1 | **Setup → Products**: nyalakan satu tool | Muncul peringatan dengan tombol **Update site** | [ ] |
| 8.2 | Klik **Update site** di situ | Peringatan hilang; tool aktif di situs | [ ] |
| 8.3 | Fake doors | "Coming soon", tidak ada saklar | [ ] |
| 8.4 ⚡ | **Overview** | Angka Open/Ongoing/Completed, grafik 14 hari, halaman terbanyak, "Where the script runs" sesuai data | [ ] |
| 8.5 | Sidebar: lipat **Setup** / **Results**, refresh | Status lipatan diingat | [ ] |
| 8.6 | Results hanya menampilkan tool yang aktif | Tool yang mati tidak muncul di Results | [ ] |

---

## 9. Riset — **Results → All studies**

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 9.1 | **New study** → Usability test: 2 tugas (mis. "buka keranjang" dengan aturan halaman `/cart`) | Studi tersimpan | [ ] |
| 9.2 | **Participant link** → salin → buka di Browser B | Layar persetujuan (consent) muncul | [ ] |
| 9.3 | Tolak (No) | Tidak ada yang direkam | [ ] |
| 9.4 | Buka lagi, **I agree** → kerjakan tugas → **Done** | Bar tugas tampil; "Thank you" di akhir | [ ] |
| 9.5 | Panel → **Results** studi | Tabel tugas (Success, waktu), Clicks by page, peserta & **Path** | [ ] |
| 9.6 | **Participants (CSV)** dan **Clicks, pages and gaze (CSV)** | Dua file terunduh, kolom "task 1 outcome", dst. | [ ] |
| 9.7 | Tombol heatmap pada halaman | Situs terbuka dengan heatmap di atas halaman (reviewer) | [ ] |
| 9.8 | 5-second test: buat, buka link peserta | Halaman tampil 5 detik lalu tertutup; pertanyaan muncul; jawaban tersimpan | [ ] |
| 9.9 | (Labs) Usability test dengan eye tracking: peserta izinkan kamera, kalibrasi | Kalibrasi selesai; video **tidak** disimpan; heatmap gaze tersedia (akurasi tergantung cahaya) | [ ] |
| 9.10 | **Results → Participant paths** | Daftar peserta + langkah mereka; tombol CSV | [ ] |
| 9.11 | **Clear results** pada studi | Peserta & heatmap kosong; studi & link tetap ada | [ ] |
| 9.12 | Hapus studi | Hilang beserta datanya | [ ] |

---

## 10. Reviewers, Settings, data

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 10.1 | **Reviewers**: daftar reviewer tampil; hapus satu | Reviewer itu tidak bisa berkomentar lagi | [ ] |
| 10.2 | **Settings → Data**: Clear install reports (ketik id proyek) | Daftar "Where the script runs" kosong, terisi lagi saat situs dibuka | [ ] |
| 10.3 | **Settings → Data**: Clear all comments | Semua komentar hilang (pakai proyek uji!) | [ ] |
| 10.4 | Ganti nama proyek / akun | Tersimpan | [ ] |
| 10.5 | Hapus proyek (proyek uji saja) | Snippet di situs tidak menampilkan apa pun | [ ] |
| 10.6 | **User guide** dari sidebar | Panduan tampil; daftar isi mengikuti scroll | [ ] |

---

## 10b. Email notifikasi (setelah setup email di `apps/saas/supabase/README.md`)

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 10b.1 | Settings → Project → **Email me about new feedback** = *When feedback arrives* | Toast "You’ll get an email when feedback arrives" | [ ] |
| 10b.2 | Browser B (reviewer): buat 2 komentar | Dalam ≤ 5 menit, **satu** email "…: 2 new comments and replies" ke email tim | [ ] |
| 10b.3 | Klik **Open your comments** di email | Panel → Comments terbuka | [ ] |
| 10b.4 | Balas komentar dari panel (sebagai pemilik) | **Tidak** ada email untuk balasan Anda sendiri | [ ] |
| 10b.5 | Reviewer membalas | Email "a new reply" | [ ] |
| 10b.6 | Ubah ke *One summary a day*, reviewer berkomentar | Tidak ada email sekarang; ringkasan datang besok 08:00 WIB | [ ] |
| 10b.7 | Ubah ke *Off*, reviewer berkomentar | Tidak ada email | [ ] |
| 10b.8 | Daftar akun baru / Forgot password | Email konfirmasi & reset datang dari alamat domain Anda (bukan Supabase) | [ ] |

Kalau email tidak datang: lihat bagian "Check it" di `apps/saas/supabase/README.md` (query `cron.job_run_details`, `net._http_response`, log Edge Function).

## 11. Keamanan & privasi (cek cepat)

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 11.1 | Buka https://securityheaders.com → masukkan `https://whatvibecodingcando.vercel.app/app` | Nilai A/B; ada HSTS, X-Frame-Options, Referrer-Policy | [ ] |
| 11.2 | Di situs uji, isi kolom form (mis. email) lalu buat komentar di dekatnya | Isi kolom **tidak** muncul di komentar/data | [ ] |
| 11.3 | Elemen dengan `data-private` di situs uji, peserta mengklik | Di hasil studi tercatat "(private)", bukan teksnya | [ ] |
| 11.4 | Coba buka panel proyek orang lain (ganti id di alamat) | Tidak bisa melihat data | [ ] |
| 11.5 | Snippet di domain yang **tidak** terdaftar | Widget tidak muncul | [ ] |
| 11.6 | Buka `https://whatvibecodingcando.vercel.app/landing/assets/` lalu cari file `.map` (DevTools → Sources) | Tidak ada source map; kode termampatkan | [ ] |
| 11.7 | GitHub → repo → Settings | Repo **Private** (lihat `docs/SECURITY.md`) | [ ] |

---

## 12. Analytics (PostHog) — setelah key diisi

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 12.1 | Buka `/` → PostHog **Activity** | `$pageview` muncul dalam ±30 detik | [ ] |
| 12.2 | Klik Get started, daftar akun uji, selesaikan onboarding | Berurutan: `get_started_clicked`, `signup_completed`, `onboarding_completed` (+ `snippet_copied`) | [ ] |
| 12.3 | Buka satu event → **Properties** | Tidak ada email, nama, isi komentar; alamat share berbentuk `#/share/:token` | [ ] |
| 12.4 | DevTools → Network → filter `posthog` di halaman situs pelanggan (bukan `/app`) | **Tidak ada** permintaan ke PostHog dari script widget | [ ] |

---

## 13. Performa

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 13.1 | https://pagespeed.web.dev → `https://whatvibecodingcando.vercel.app/` (mobile) | Performance ≥ 70; tidak ada error besar | [ ] |
| 13.2 | Situs uji sebagai **pengunjung biasa** → DevTools → Network | Hanya `vibe.js` kecil (±10 KB); **tidak** memuat `vibe-app.js` | [ ] |
| 13.3 | Panel `/app` → Network | Tidak memuat `DemoApp`/`vision_` (model eye tracking) | [ ] |

---

## 14. Cek data di Supabase (opsional, hanya baca)

Di Supabase → **SQL Editor** (query di bawah hanya membaca, aman):

```sql
-- jumlah data per tabel utama
select (select count(*) from projects) projects, (select count(*) from threads) comments,
       (select count(*) from replies) replies, (select count(*) from reviewers) reviewers,
       (select count(*) from studies) studies, (select count(*) from runs) participants;

-- 5 komentar terbaru (cek versi & perangkat tersimpan)
select page, kind, version, anchor->'device' as device, created_at from threads order by created_at desc limit 5;

-- fungsi & index dari SQL 10 sudah ada?
select indexname from pg_indexes where indexname in ('runs_project_started_idx','run_events_project_page_kind_idx','rate_hits_minute_idx');
```

---

## 15. Tes otomatis (untuk developer)

Di komputer dengan Node 22:

```bash
npm run install:all
npm run typecheck && npm run build     # wajib lulus sebelum push
npm run preview                         # buka http://localhost:4173/ (website) dan /app.html (aplikasi)
```

Tes database (butuh PostgreSQL 16 lokal): `cd apps/saas/supabase && bash tests/run.sh` → semua file harus "ALL PASS".

---

## Template laporan bug

```
Judul: [Area] ringkas, mis. "[Comments] Voice note tidak bisa diputar di panel"
Tanggal & jam:
Browser / perangkat: (mis. Chrome 131, macOS / Android Chrome)
Akun / proyek: (id proyek, bukan password)
Langkah:
1.
2.
Yang diharapkan:
Yang terjadi:
Screenshot / rekaman layar:
Console (F12 → Console, salin error merah):
```

Prioritas: **P0** (tidak bisa daftar/login, data hilang, data bocor) → perbaiki hari itu; **P1** (fitur utama rusak) → minggu itu; **P2** (tampilan/teks) → kumpulkan.
