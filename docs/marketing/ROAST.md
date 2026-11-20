# Roast — kritik keras atas produk, rencana dan materi

*Dibaca seolah saya investor skeptis, kompetitor, dan pengguna Reddit yang sinis. Setiap poin punya status: ✅ sudah diperbaiki di dokumen, ⚠️ butuh keputusan/aksi Anda.*

---

### 1. "Vibe Collab" itu nama kerja, dan menempel ke tren. ⚠️
Nama ini masih ditulis "a working name" di produk. "Vibe" terikat tren *vibe coding* yang bisa memudar, dan ICP #1 kita (agensi dengan klien awam) tidak peduli soal vibe coding. Product Hunt, backlink direktori dan SEO menempel ke nama + domain **selamanya**.
**Aksi:** putuskan nama & beli domain **sebelum** minggu 3 (launch boards). Kalau tetap "Vibe Collab", hapus label "working name".

### 2. Domain `*.vercel.app` terlihat seperti proyek hobi. ⚠️
Di Product Hunt dan HN, domain gratisan langsung menurunkan kepercayaan, apalagi untuk script yang dipasang di situs produksi orang.
**Aksi:** domain sendiri di minggu 0 (±$10–20/tahun). ✅ Sudah dijadikan syarat di `PLAN.md`.

### 3. Meluncur tanpa "table stakes" = dibandingkan dan kalah. ✅
Komentar pertama di Product Hunt hampir pasti: *"Marker.io/Userback punya screenshot, console log, MCP. Ini punya apa?"* Tanpa screenshot dan notifikasi email, pengguna mencoba sekali lalu lupa.
**Perbaikan:** `PLAN.md` minggu 0 sekarang **mengunci** peluncuran besar sampai screenshot + email selesai; semua teks dilarang mengklaim fitur yang belum ada; maker comment punya instruksi "hapus baris yang belum benar".

### 4. "Fix it with AI" bukan pembeda — pesaing sudah punya MCP. ✅
Faster Fixes (open source), Feedboon, Userback dan Feedbucket sudah menyambungkan feedback ke Cursor/Claude Code.
**Perbaikan:** pesan utama diubah urutannya: (1) klien tanpa akun, (2) feedback + riset satu script, (3) $2/situs. AI prompt jadi *bonus*, bukan headline. Pertanyaan "MCP vs Jira dulu?" dipakai di maker comment untuk riset sekaligus engagement.

### 5. Product Hunt bukan tempat ICP #1 berkumpul. ✅
Agensi kecil Indonesia tidak menunggu di Product Hunt pukul 15:01 WIB. Product Hunt = kredibilitas, backlink dan pengguna global awal, **bukan** mesin akuisisi utama.
**Perbaikan:** `PLAN.md` menaruh outreach personal & komunitas Indonesia di minggu 1 (target 10 pengguna aktif dulu), dan Product Hunt di minggu 4 setelah ada testimoni nyata.

### 6. $2 terdengar seperti "akan tutup bulan depan". ✅
Pembeli B2B curiga harga terlalu murah; margin juga tipis (biaya tetap ±$45–65/bulan, storage voice note & screenshot per situs).
**Perbaikan:** dibingkai sebagai **harga founding, dikunci untuk 200 pelanggan pertama**, harga normal direncanakan **$5/situs**; jawaban siap pakai ada di `PRODUCT-HUNT.md` §8. ⚠️ Anda perlu menyetujui angka $5 itu sebelum diumumkan.

### 7. Nol bukti sosial. ⚠️
Landing page dan Product Hunt tidak punya satu pun testimoni, logo, atau angka. Pengunjung HN/PH yang skeptis akan pergi.
**Aksi:** target 10 kutipan nyata di minggu 1–3 (dengan izin tertulis). **Jangan pernah mengarang** — itu juga aturan repo.

### 8. "Pasang satu baris script" — tapi vibe coder tidak tahu di mana `</body>`. ✅/⚠️
Pengguna Lovable/Bolt jarang membuka `index.html`. Aktivasi (script terdeteksi) akan jadi titik bocor terbesar.
**Perbaikan:** halaman Install sudah punya prompt "Ask an AI assistant". **Aksi tambahan disarankan:** halaman panduan khusus "Add Vibe Collab to a Lovable / Bolt / v0 app" (juga bagus untuk SEO) — masukkan ke minggu 0–1.

### 9. Bahasa: menjual ke klien Indonesia dengan widget berbahasa Inggris. ⚠️
Klien agensi lokal (pemilik toko, UMKM) akan bingung dengan "Comment", "Reply", "Set as completed".
**Aksi:** widget Bahasa Indonesia otomatis (MVP #5 di `PRODUCT-ANALYSIS.md`). Ini pembeda lokal termurah — kerjakan sebelum outreach besar ke agensi.

### 10. Eye tracking bisa jadi bahan ejekan. ✅
"Webcam eye tracking" di headline mengundang komentar "akurasinya pasti jelek".
**Perbaikan:** disebut sekali, selalu dengan label **Labs** dan penjelasan jujur; tidak ada di tagline.

### 11. Video demo memakai screenshot WhatsApp. ✅
Kalau memakai chat asli, bisa membocorkan data klien.
**Perbaikan:** catatan di bawah — pakai chat buatan atau blur semua nama/nomor.

### 12. Satu founder, launch 24 jam, token AI terbatas. ✅
Membalas komentar ≤ 30 menit selama 24 jam tidak realistis sendirian.
**Perbaikan:** jadwal jam per jam + minta satu teman memantau malam; jawaban siap pakai untuk 10 pertanyaan; `docs/TESTING.md` supaya Anda bisa memverifikasi tanpa AI.

### 13. Reddit: satu langkah salah = ban. ✅
r/SaaS membatasi promosi (dilaporkan 1x per 60 hari); DM massal pernah berujung ban.
**Perbaikan:** semua post Reddit berbentuk minta feedback, link di komentar, satu subreddit per hari, tanpa DM massal; r/SaaS hanya sekali dan setelah ada angka nyata.

### 14. Landing page menargetkan "AI-built products", outreach menargetkan agensi. ⚠️
Dua pesan berbeda bisa membingungkan, tapi bisa juga saling melengkapi.
**Keputusan saya (head of marketing):** landing tetap untuk audiens global/AI builder (Product Hunt, HN, Reddit); outreach Indonesia memakai pesan "revisi klien tanpa screenshot WhatsApp". Setelah 6 minggu, pertahankan pesan yang konversinya lebih tinggi (lihat `$initial_utm_source` di PostHog).

---

## Hasil akhir roast
- Diperbaiki langsung di dokumen: #3, #4, #5, #6 (pembingkaian), #10, #11, #12, #13.
- **Menunggu keputusan Anda:** nama & domain (#1–2), angka harga normal $5 (#6), testimoni (#7), panduan Lovable (#8), widget Bahasa Indonesia (#9), pilihan pesan (#14).
- Paket ini **siap dipakai** begitu minggu 0 di `PLAN.md` selesai.
