# Panduan testing manual — ourhunch

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
| 1.1 ⚡ | Buka `/` | Landing page tampil (judul "ourhunch — the review layer for AI-built products"), tanpa error | [ ] |
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
| 2.1 ⚡ | Mode server, Browser A: `/app#/app/register` → isi nama + email → **Email me a code** | Layar "Check your email" dengan satu kolom kode 6 digit; tidak ada kolom password | [ ] |
| 2.2 ⚡ | Buka email (subjek "Your ourhunch code: 123456") → ketik/tempel kode | Kode langsung dicek → onboarding (pilihan `?products=` tetap terbawa); nama tampil di Settings | [ ] |
| 2.2a | Masukkan kode salah / kode lama (>10 menit) | "That code isn’t right…" / "That code has expired…" | [ ] |
| 2.2b | Tombol **Send a new code** | Nonaktif 60 detik (hitung mundur), lalu mengirim kode baru | [ ] |
| 2.2c | Log in → email yang **tidak** punya akun → **Email me a code** | Pesan sama "If … has an account, we sent it a code" + link **Create an account**; tidak ada email terkirim, tidak ada akun dibuat | [ ] |
| 2.2d ⚡ | Log in → email terdaftar → kode | Masuk ke Overview | [ ] |
| 2.2e | Log in → **Use a password instead** | Kolom password + **Forgot password?** muncul; login dengan password tetap bisa | [ ] |
| 2.2f | Mode demo (tanpa Supabase): Register/Log in | Tetap pakai password lokal seperti sebelumnya | [ ] |
| 2.3 | Password lemah (mis. `12345678`) | Ditolak dengan pesan yang jelas | [ ] |
| 2.4 | Log out → **Log in** dengan password salah | Pesan error; tidak masuk | [ ] |
| 2.5 ⚡ | Log in dengan password benar | Masuk ke Overview | [ ] |
| 2.6 | **Forgot password** → email → link reset → password baru | Bisa login dengan password baru | [ ] |
| 2.7 | Buka `/app#/app` saat log out | Diarahkan ke login | [ ] |
| 2.8 | (Setelah Google diaktifkan di Supabase) **Continue with Google** di halaman Register | Pilih akun Google → kembali ke app → onboarding (akun baru) atau Overview (akun lama) | [ ] |
| 2.9 | Klik **Continue with Google**, lalu batalkan di layar Google | Kembali ke Log in dengan pesan "Google sign-in didn’t finish" | [ ] |
| 2.10 | Akun Google → **Settings → Password** | Tertulis "You log in with Google"; bisa **Set password** tanpa password lama, lalu login dengan email + password | [ ] |
| 2.11 | Google dimatikan di Supabase → buka Log in | Tombol Google tidak tampil | [ ] |
| 2.12 ⚡ | Buka `/app#`, `/app#/xyz` | Tidak pernah tampil toko demo (Marketplace); diarahkan ke panel / log in | [ ] |
| 2.13 | Buka `/app#/admin` | Halaman sign-in ops | [ ] |
| 2.14 | Buka `/embed-demo.html` | Halaman demo widget tetap jalan seperti biasa | [ ] |

---

## 3. Onboarding

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 3.1 | Langkah 1: pilih tool (dikelompokkan Feedback / Research / Design QA) | **Fake doors** tertulis "Coming soon" dan tidak bisa dipilih; **Eye tracking** berlabel "Labs" | [ ] |
| 3.2 | Langkah 2: isi nama proyek | Di bawahnya muncul id proyek (mis. `gagero`) | [ ] |
| 3.3 | Isi "Where is the site online?" dengan `trms-zeta.vercel.app` | Muncul "The widget will show on trms-zeta.vercel.app" | [ ] |
| 3.4 | Isi alamat salah (mis. `abc`) | Pesan contoh format yang benar | [ ] |
| 3.5 | Langkah 3: **Copy snippet** | Snippet berisi `src=".../embed/vibe.js"` dan `data-project="..."` saja | [ ] |
| 3.5b | Langkah 1: pilih 4 tool (mis. Comments, Inspect, Design tokens, Heatmaps), lanjut ke langkah 3, klik **Try it on the demo site** | Dock widget di situs demo berisi **keempat** tool itu (Comment, Inspect, Design tokens, Heatmap), bukan hanya Comments | [ ] |
| 3.5c | Sama, tapi pilih juga **Usability tests** / **Reports** | Catatan "You picked" di kiri bawah situs demo menjelaskan tool itu dijalankan dari panel (Research / Reports), bukan dari dock | [ ] |
| 3.5d | Desktop: arahkan mouse (atau Tab) ke kartu tool, tunggu sebentar | Muncul popover berisi video pendek (tanpa suara, berulang), nama dan deskripsi; Esc menutupnya; halaman tidak bergeser | [ ] |
| 3.5e | HP: ketuk **Preview** pada kartu | Bottom sheet dengan video, deskripsi dan tombol **Select**; Select memilih tool dan menutup sheet; ketuk kartunya sendiri tetap memilih/membatalkan | [ ] |
| 3.5f | Aktifkan "kurangi gerakan" (reduce motion) di sistem | Popover/sheet hanya menampilkan gambar diam, tanpa video | [ ] |
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
| 6.8 | **CSV** | File terunduh; kolom page, kind, version, round, device, status, author, comment...; buka di Excel tanpa error/rumus aneh | [ ] |
| 6.9 | **Share list** → buat link → buka di Browser B (tidak login) | Daftar komentar tampil read-only | [ ] |
| 6.10 | Cabut (revoke) share link → buka lagi | Link tidak berfungsi | [ ] |
| 6.11 | **Open on site** pada komentar | Halaman situs terbuka di elemen terkait, sebagai reviewer | [ ] |
| 6.12 | Hapus satu komentar (ikon tempat sampah) | Hilang setelah konfirmasi | [ ] |
| 6.13 | Filter lalu **Delete these (n)** | Hanya yang terfilter terhapus | [ ] |
| 6.14 | Setelah 5.x: ubah situs (ganti class, pindahkan tombol, hapus satu elemen) lalu buka lagi sebagai reviewer | Pin yang elemennya hanya ganti class tetap normal; tombol yang pindah: pin putus-putus "Moved?"; elemen yang dihapus: pin abu-abu, kartu "Element changed or removed" + deskripsi (mis. button “Buy now”) | [ ] |
| 6.15 | Pada pin "Moved?" tekan **Yes, this one**; pada pin abu-abu tekan **Pick element** lalu klik elemen yang benar | Pin jadi normal; setelah reload tetap di elemen itu (juga di browser lain) | [ ] |
| 6.16 | Panel → Comments → filter **Needs re-pin** | Komentar dengan pin moved/gone tampil dengan "was on: … · not found since vX"; **Close** menyelesaikannya | [ ] |
| 6.17 | Tambahkan `data-hunch="buy"` pada tombol, buat komentar, lalu ubah teks & posisinya | Pin tetap di tombol itu tanpa "Moved?" | [ ] |

---

## 6b. Review rounds — **Settings → Review rounds**, **Results → Rounds**

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 6b.1 | Project lama tanpa mengubah apa pun | Widget & komentar sama seperti sebelumnya, tidak ada bar ronde; menu Rounds tidak muncul | [ ] |
| 6b.2 | Settings → **Review rounds** On, *Rounds included* = 2 | Toast "Review rounds on"; **Results → Rounds** muncul | [ ] |
| 6b.3 | Browser B (reviewer) buka situs | Bar atas "Review rounds"/ronde terakhir + pesan "The team is working on your feedback…"; tombol Comment memberi pesan yang sama, tidak bisa komentar baru; balas komentar lama tetap bisa | [ ] |
| 6b.4 | Pemilik (Open my site) di situs | Tetap bisa berkomentar walau tidak ada ronde | [ ] |
| 6b.5 | Rounds → **Start round 1** (nama, What changed, due date) | Ronde Open; kotak hijau dengan **Copy message** "Round 1 is ready for your review: <link>" dan **Copy review link** | [ ] |
| 6b.6 | **Start round** saat ronde lain masih open | Tombol nonaktif ("Close the open round first") | [ ] |
| 6b.7 | Browser B: muat ulang (≤ 1 menit) | Bar "Round 1 of 2 · due …", **What changed** bisa dibuka, **Approve this version**; komentar baru bisa, chip ronde muncul di Comments panel | [ ] |
| 6b.8 | Di HP (lebar < 640px) | Bar ringkas (bisa dibuka/tutup), tidak menggeser layout situs | [ ] |
| 6b.9 | **Approve this version**: isi nama, centang, Confirm | Tampil "N comments are still open" bila ada; setelah Confirm: toast terima kasih, ronde jadi Approved, tidak bisa komentar baru | [ ] |
| 6b.10 | Panel → Rounds | Ronde "Approved", "Approved by <nama> · waktu"; Approvals timeline; **Download record** → halaman record (project, situs, ronde, versi, nama, waktu + zona waktu, pernyataan, komentar terbuka); Print rapi | [ ] |
| 6b.11 | Email (server, notifikasi tidak Off) | Dalam ≤ 5 menit email "<project>: <nama> approved Round 1" ke tim, tombol **Open Rounds** | [ ] |
| 6b.12 | Start round 3 dengan included = 2 | Dialog memperingatkan "This is extra round 1 beyond the 2 included in this project."; label "Round 3 · Extra round" | [ ] |
| 6b.13 | **Close round**, **Reopen** (hanya ronde terakhir), **Edit** nama/catatan/due | Berubah sesuai; Reopen tidak ada di ronde lama | [ ] |
| 6b.14 | Comments → filter **Round**; CSV | Hanya komentar ronde itu; CSV punya kolom `round` | [ ] |
| 6b.15 | Mode demo (tanpa server): ulangi 6b.2–6b.10 di demo site | Sama, data di browser ini | [ ] |

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
| 8.3b | Arahkan mouse ke kartu produk di **Products** | Popover video pratinjau yang sama seperti di onboarding | [ ] |
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
| 9.11a | Heatmap (dock) dengan < 10 peserta | Muncul **Early signal: N people so far**; legenda berwarna ungu → kuning dengan satuan "per 50 px square" | [ ] |
| 9.11b | Satu peserta klik 100× di halaman yang sama | Heatmap menghitung maksimal 60 klik orang itu; daftar **Most clicked elements** menampilkan % orang dan first click | [ ] |
| 9.11c | Klik 3× cepat di gambar yang tidak bisa diklik | Dihitung sebagai rage dan dead click; klik dari script (`el.click()`) tidak tercatat | [ ] |
| 9.11d | `node apps/saas/tests/heatmap.test.ts` | Semua tes lulus (0/1 titik, titik sama, 100k titik, perangkat campur) | [ ] |
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
| 10b.1 | Settings → **Notifications** → **Email me about “…”** = *When something happens* | Toast "You’ll get an email when something happens" | [ ] |
| 10b.2 | Browser B (reviewer): buat 2 komentar | Dalam ≤ 5 menit, **satu** email "…: 2 new comments and replies" ke email tim | [ ] |
| 10b.3 | Isi email: halaman, elemen (mis. button “Pay”), baris perangkat, kutipan komentar, label *Voice note* untuk voice note, chip round kalau ada. Klik **Open your comments** / **Open comment** | Panel → Comments terbuka | [ ] |
| 10b.4 | Balas komentar dari panel (sebagai pemilik) | **Tidak** ada email untuk balasan Anda sendiri | [ ] |
| 10b.5 | Reviewer membalas | Email "a new reply" | [ ] |
| 10b.6 | Ubah ke *One summary a day*, reviewer berkomentar | Tidak ada email sekarang; ringkasan datang besok 08:00 WIB | [ ] |
| 10b.7 | Ubah ke *Off*, reviewer berkomentar | Tidak ada email | [ ] |
| 10b.8 | Daftar akun baru / Forgot password | Email konfirmasi & reset datang dari alamat domain Anda (bukan Supabase), dengan tampilan ourhunch (template di `apps/saas/supabase/email-templates/`) | [ ] |
| 10b.9 | Partisipan menyelesaikan studi (Research) | Email "…: N new results in “<nama studi>”" + persentase tugas berhasil, tombol **See results** | [ ] |
| 10b.10 | Rounds aktif, round terbuka; reviewer membuka link review pertama kali | Satu email "your client started reviewing" (sekali per round, bukan untuk browser tim) | [ ] |
| 10b.11 | Round terbuka dengan due date = besok, belum di-approve | Satu email "<round> is due tomorrow" (sekali per round) | [ ] |
| 10b.12 | Reviewer klik Approve | Email dengan nama approver, round, versi, jumlah komentar terbuka, tombol **View approval record** membuka record-nya | [ ] |
| 10b.13 | Pasang script di situs baru (project baru) | Satu email "ourhunch is live on <situs>", tombol **Send your first review link** (sekali per project) | [ ] |
| 10b.14 | Daftar akun baru dan konfirmasi email | Dalam ≤ 5 menit email **Welcome to ourhunch** (tanda tangan `EMAIL_FOUNDER_NAME`, balasan ke `EMAIL_REPLY_TO`) | [ ] |
| 10b.15 | Akun baru, ≥ 24 jam, belum pasang script | Email "Add ourhunch in 2 minutes" (jalan harian). Kalau script sudah terpasang: tidak dikirim | [ ] |
| 10b.16 | Klik **Unsubscribe** di email tips | Halaman "You’re unsubscribed" tanpa login; Settings → Notifications → *Tips and product updates* jadi off | [ ] |
| 10b.17 | Di Gmail: menu ⋮ → *Unsubscribe* (dari header List-Unsubscribe) | Tips jadi off | [ ] |
| 10b.18 | Senin, ada aktivitas 7 hari terakhir | Email "Your week on …" ke pemilik akun; tidak ada kalau project di-set *Off* | [ ] |
| 10b.19 | Settings → Notifications → matikan/nyalakan *Tips and product updates* | Toast "Tips off"/"Tips on"; tersimpan setelah reload | [ ] |
| 10b.20 | Footer setiap email | Alasan menerima email, link pengaturan, alamat bisnis (kalau `EMAIL_POSTAL_ADDRESS` diisi); email tips juga ada **Unsubscribe** | [ ] |

Pratinjau semua email (gambar): `docs/email-previews/`.

Kalau email tidak datang: lihat bagian "Check it" di `apps/saas/supabase/README.md` (query `cron.job_run_details`, `net._http_response`, log Edge Function).

## 10b-2. Email selamat datang (sekali, dalam ±5 menit setelah login pertama)

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 1 | Daftar dengan email, klik link konfirmasi | Email "welcome" datang dalam ±5 menit, hanya sekali | |
| 2 | Daftar dengan Google (akun baru) | Email "welcome" dalam ±5 menit | |
| 3 | Daftar dengan kode email (OTP), jangan masukkan kodenya | Tidak ada welcome; setelah kode dimasukkan → welcome dalam ±5 menit | |

## 10c. Panel ops internal (`/app#/admin`, hanya founder)

| # | Langkah | Hasil yang diharapkan | ✔ |
|---|---|---|---|
| 1 | Buka `/app#/admin`, login dengan akun biasa (bukan admin) | Ditolak: "Email or password is incorrect, or this account has no ops access."; panel pelanggan tidak punya link Ops | |
| 2 | Jalankan SQL admin di README Supabase ("Internal ops panel") untuk email Anda, login di `/app#/admin` | Dashboard ops tampil; tombol Sign out; tutup tab lalu buka lagi = harus login ulang | |
| 3 | Buka Ops | Kotak angka, grafik signup/proyek per hari, funnel dengan persen, meter "Founding seats N / 200", tabel user, log aksi | |
| 4 | Cari user lewat email, ganti halaman (Next/Previous), klik email | Hasil sesuai; laci detail menampilkan workspace/proyek tanpa teks komentar | |
| 5 | "Set plan" → Founding + catatan → Save | Badge berubah; baris baru di "Recent admin actions" | |
| 6 | Build demo (tanpa Supabase), buka `/app#/admin` | "Ops needs the server" | |
| 7 | Tabel user: kolom **Widget** | Not installed (script belum pernah lapor dari situs asli) / Installed (script terlihat, belum ada aktivitas) / In use (komentar, reviewer, studi dalam 14 hari) / Inactive (lebih dari 14 hari sepi); arahkan kursor ke badge untuk penjelasan | |
| 8 | Filter "Widget" → In use, lalu Sort → Last activity | Hanya user In use (angka per status di menu); yang paling baru aktif di atas | |
| 9 | Kolom Last script seen, Last activity, Last comment, Comments 7d / all, Reviewers, Studies / results, Rounds | Terisi sesuai data; "—" bila belum ada | |
| 10 | Klik email → laci detail | Per proyek: origin, status widget, last seen, komentar, reviewer, studi, aktivitas terakhir | |
| 11 | Kotak angka | Ada "Sites in use (14d)" | |

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
| 12.2 | Klik Get started, daftar akun uji, selesaikan onboarding | Berurutan: `cta_clicked` (location, target=signup), `signup_started`, `signup_completed` (method=email), `onboarding_completed` (products = id saja) (+ `snippet_copied`) | [ ] |
| 12.2b | Gulir ke Pricing di `/` | `pricing_viewed` sekali | [ ] |
| 12.2c | PostHog → Persons → akun uji | distinct id = id akun; properti `plan`, `signup_method`, `created_at`, `projects`, `products`; tanpa email/nama; `$initial_utm_source` terisi bila datang dari `/?utm_source=tes` | [ ] |
| 12.2d | PostHog → Groups → workspace | Satu grup per workspace (id, `projects`, `plan`), tanpa nama | [ ] |
| 12.2e | Daftar dengan Google | `signup_completed` method=google (login berikutnya: `login_completed` method=google) | [ ] |
| 12.3 | Buka satu event → **Properties** | Tidak ada email, nama, isi komentar; alamat share berbentuk `#/share/:token` | [ ] |
| 12.3b | Pasang script, dapat komentar pertama, selesaikan komentar, salin AI prompt, buat studi, buka hasil, ekspor CSV, ganti notifikasi | `install_detected`, `first_comment_received` (sekali per proyek), `comment_resolved`, `fix_prompt_copied`, `study_created`, `study_results_viewed`, `csv_exported`, `settings_notify_changed` | [ ] |
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

Tes pin (tanpa browser): `node apps/saas/tests/anchor.test.ts` → semua "ok".

Tes database (butuh PostgreSQL 16 lokal): `cd apps/saas/supabase && bash tests/run.sh` → semua file harus "ALL PASS".

Tes email (tanpa server), dari `apps/saas`: `npx esbuild supabase/functions/send-emails/test.ts --bundle --platform=node --format=esm --outfile=/tmp/se.mjs && node /tmp/se.mjs` → "ALL PASS". Pratinjau HTML semua email: sama dengan `preview.ts` lalu `node /tmp/se-preview.mjs /tmp/email-previews` (juga menulis ulang template Auth).

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
