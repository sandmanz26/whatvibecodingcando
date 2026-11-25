# PostHog untuk ourhunch — panduan praktis

Analytics hanya ada di website (`/`, `apps/landing/src/analytics.ts`) dan aplikasi (`/app`, `apps/saas/src/lib/analytics.ts`), aktif bila `VITE_POSTHOG_KEY` diisi di Vercel. **Tidak pernah** di script widget di situs pelanggan. Tanpa autocapture, tanpa session recording. Tidak pernah mengirim email, nama, teks komentar atau isi kolom.

## 1. Daftar event (object_action, snake_case)

| Event | Di mana | Properti | Pertanyaan produk yang dijawab |
|---|---|---|---|
| `$pageview` | website, app | url (token dibersihkan) | Halaman mana yang dilihat? |
| `cta_clicked` | website | `location` (section), `target` (signup/login/demo), `products`, `utm_*` | CTA mana yang paling banyak membawa signup? |
| `pricing_viewed` | website | — | Berapa pengunjung yang sampai ke harga? |
| `signup_started` | app | `method` (email/demo) | Berapa yang membuka form daftar tapi tidak selesai? |
| `signup_completed` | app | `method` (email/google/demo), `products` | Berapa signup, lewat apa? |
| `login_completed` | app | `method` | Seberapa sering orang kembali? |
| `onboarding_completed` | app | `products` (id), `products_count`, `site`, `copied` | Alat apa yang dipilih orang? |
| `snippet_copied` | app | `where` (onboarding/install) | Niat memasang |
| `install_detected` | app | `shown` | **Aktivasi 1:** script benar-benar terpasang (sekali per proyek) |
| `widget_published` | app | `where` (widget/products) | Seberapa sering setelan widget diubah |
| `open_my_site` | app | — | Pemilik mencoba sendiri |
| `review_link_created` | app | — | **Aktivasi 2:** mengundang reviewer |
| `first_comment_received` | app | — | **Aktivasi 3 (aha):** komentar pertama (sekali per proyek) |
| `comment_resolved` | app | — | Apakah feedback ditindaklanjuti? |
| `fix_prompt_copied` | app | `count` | Fitur "AI prompt" dipakai? |
| `csv_exported` | app | — | Ekspor dipakai? |
| `study_created` | app | `kind`, `eye_tracking` | Riset dipakai? |
| `study_results_viewed` | app | `runs` | Hasil studi dibaca? |
| `rounds_turned_on/off`, `round_started` | app | `n` | Review rounds dipakai? |
| `round_approved_seen` | app | `n` | Klien menyetujui (sekali per ronde) |
| `settings_notify_changed` | app | `notify` (instant/daily/off) | Apakah email terlalu banyak? |

**Nama yang diganti** (data lama tetap dengan nama lama; di insight pakai keduanya bila perlu melihat masa lalu):
`get_started_clicked` / `login_clicked` / `demo_opened` → `cta_clicked` (target signup/login/demo) · `script_detected` → `install_detected` · `comments_exported` → `csv_exported` · `site_updated` → `widget_published` · properti `mode` di signup → `method`.

**Person** (identify = id akun, bukan email): `plan`, `signup_method` (set sekali), `created_at` (set sekali), `projects`, `has_installed`, `products` (id alat). Juga otomatis: `$initial_utm_source/medium/campaign`, `$initial_referrer` (first touch, dari cookie yang sama di `/` dan `/app`).
**Group** `workspace` (id workspace): `projects`, `plan`.

## 2. Persiapan sekali di PostHog

1. **Project settings → Group analytics**: pastikan aktif (paket berbayar/add-on). Tipe grup `workspace` muncul sendiri setelah event pertama; beri nama tampilan "Workspace".
2. **Project settings → Autocapture**: biarkan *off* (kode sudah mematikan; ini cadangan). **Session replay**: off.
3. **Data management → Events**: beri deskripsi tiap event dari tabel di atas. Tandai event lama (`get_started_clicked`, `script_detected`, `comments_exported`, `site_updated`) sebagai *hidden* setelah 30 hari.
4. **Settings → Filter out internal and test users**: tambahkan filter `email` tidak bisa (kita tidak kirim email) — pakai *person property* `plan` ≠ `internal` atau cohort id akun tim Anda.

## 3. Funnel aktivasi (insight utama)

1. **Product analytics → + New insight → Funnels**.
2. Langkah (urut):
   1. `signup_completed`
   2. `onboarding_completed`
   3. `install_detected`
   4. `review_link_created`
   5. `first_comment_received`
3. **Conversion window**: 14 hari. **Step order**: Sequential. **Aggregating by**: Unique users (atau *Unique workspaces* untuk melihat per tim).
4. **Breakdown**: `method` (event property dari langkah 1) → apakah Google lebih aktif dari email? Coba juga breakdown `$initial_utm_source` (person) → kanal mana yang menghasilkan pengguna aktif, bukan sekadar signup.
5. Simpan sebagai "Activation funnel", tambahkan ke dashboard (langkah 5).
6. Klik bar yang turun paling tajam → **View persons who dropped off** → **Save as cohort** untuk di-email/diwawancara.

Tambahan: funnel website `$pageview` (url = `/`) → `cta_clicked` (target = signup) → `signup_completed` — breakdown `location` untuk tahu section mana yang menjual.

## 4. Retention

1. **+ New insight → Retention**.
2. **Cohortizing event**: `signup_completed` (first time). **Returning event**: `first_comment_received` *atau* lebih baik "any of" `comment_resolved`, `review_link_created`, `study_results_viewed`, `fix_prompt_copied` (aktivitas nilai, bukan sekadar login).
3. Periode: **Week**, 8 minggu. Simpan sebagai "Weekly value retention".
4. Versi kedua dengan returning event `login_completed` untuk membandingkan "kembali" vs "kembali dan mendapat nilai".

## 5. Dashboard tren

**Dashboards → New dashboard → "ourhunch weekly"**, isi dengan insight **Trends** (interval Week, 12 minggu):

| Kartu | Seri |
|---|---|
| Signups | `signup_completed` total, breakdown `method` |
| Pemasangan baru | `install_detected` total |
| Undangan reviewer | `review_link_created` total |
| Komentar pertama | `first_comment_received` total |
| Feedback ditindaklanjuti | `comment_resolved` + `fix_prompt_copied` |
| Riset | `study_created`, `study_results_viewed` |
| Ronde | `round_started`, `round_approved_seen` |
| Workspace aktif | `$pageview` *unique groups (workspace)*, interval Week |
| Website → signup | `cta_clicked` breakdown `location` |
| Email terlalu banyak? | `settings_notify_changed` breakdown `notify` |

Tambahkan juga "Activation funnel" dan "Weekly value retention". Atur **Subscribe → email Senin pagi**.

## 6. Cohort "terpasang tapi belum ada komentar"

1. **People → Cohorts → New cohort**, nama "Installed, no comments".
2. Kriteria (AND):
   - *Completed event* `install_detected` **in the last 30 days**
   - *Did not complete event* `first_comment_received` **in the last 30 days**
3. Simpan (dynamic). Gunakan: breakdown di funnel, dan bandingkan dengan panel Ops (`/app#/admin`, filter Widget = Installed) untuk menghubungi mereka. Cohort lain yang berguna: "Signed up, not installed" (`signup_completed` 14 hari, tanpa `install_detected`), "In use" (`first_comment_received` atau `comment_resolved` 14 hari).

## 7. Cek cepat setelah deploy

Lihat `docs/TESTING.md` bagian 12. Bila properti person kosong: pastikan login di `/app` (identify hanya terjadi setelah login). Bila `$initial_utm_*` kosong: buka `/?utm_source=tes` di jendela private, lalu daftar — cookie PostHog berlaku untuk seluruh origin (path `/`), jadi `/` dan `/app` adalah kunjungan yang sama.
