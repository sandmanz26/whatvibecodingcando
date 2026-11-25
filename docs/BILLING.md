# Billing ourhunch — siap, tapi MATI sampai Anda menyalakannya

Status hari ini: **semua logika pembayaran sudah ada, tapi mati.** Tidak ada yang ditagih, panel menulis
"Free during the beta — billing isn't switched on yet", dan tidak ada batas situs. Billing baru jalan setelah
Anda menyelesaikan langkah di bawah dan menyalakan **dua** saklar (secret `BILLING_ENABLED` dan baris
`app_settings.billing_enabled`).

Harga (sama dengan `apps/saas/src/saas/products.ts` → `PRICING`): Free = 1 situs; Pro = $4.80/situs/bulan;
harga founding $2/situs/bulan untuk 200 workspace pembayar pertama, terkunci selama langganannya tetap aktif.

## 1. Provider: rekomendasi Paddle

| Provider | Penjual di Indonesia? | Merchant of record (urus PPN/VAT/sales tax global) | Harga per kuantitas (per situs) | Payout | Catatan |
|---|---|---|---|---|---|
| **Paddle Billing** | Ya: Indonesia tidak ada di daftar negara yang tidak didukung | **Ya** | Ya (quantity per item) | Transfer bank, Payoneer (USD), PayPal | **Rekomendasi** |
| Lemon Squeezy | Dulu ya (payout bank ke Indonesia ada) | Ya | Ya | Bank / PayPal | **Tidak bisa dipakai**: pendaftaran toko baru ditutup 16 Nov 2026, berhenti memproses pembayaran 31 Mar 2027 |
| Stripe (termasuk Managed Payments) | Tidak untuk badan usaha Indonesia secara langsung | Managed Payments: ya, tapi butuh akun Stripe | Ya | — | Tidak tersedia untuk Anda tanpa badan usaha di luar negeri |
| Xendit | Ya (perusahaan Indonesia) | **Tidak** (payment gateway saja) | Ya (recurring API) | Rekening Indonesia | Pajak lintas negara jadi urusan Anda sendiri |
| Midtrans | Ya | **Tidak** | Terbatas | Rekening Indonesia | Fitur langganan lebih sedikit; pajak urusan Anda |

Alasan memilih Paddle:
1. **Merchant of record**: Paddle menjadi penjual resmi ke pelanggan, memungut dan menyetor PPN/VAT/GST/sales
   tax di seluruh dunia, membuat invoice, menangani refund dan chargeback. Pelanggan ourhunch sebagian besar
   di luar negeri, jadi ini menghindari registrasi pajak di puluhan negara. Xendit/Midtrans tidak melakukan ini.
2. Menerima penjual dari Indonesia dan membayar ke rekening bank (atau Payoneer/PayPal).
3. Harga per kuantitas: satu price "Pro per situs", kuantitas = jumlah situs. Ubah jumlah situs dan batal
   bisa dilakukan pelanggan sendiri di customer portal Paddle (termasuk unduh invoice).
4. Lemon Squeezy, alternatif yang biasa dipakai founder Indonesia, sedang ditutup.

Biaya (cek ulang di halaman harga Paddle): sekitar 5% + $0.50 per transaksi.

Kode tidak terikat ke Paddle: `apps/saas/supabase/functions/billing/provider.ts` mendefinisikan interface
`BillingProvider` (createCheckout, portalUrl, verify, parse). Provider lain = satu file baru seperti `paddle.ts`
plus satu baris di `providerFor()` di `index.ts`, plus nilai baru di check constraint `provider` di SQL.

Sumber:
- Paddle, negara yang didukung: https://www.paddle.com/help/legal/sanctions/which-countries-are-supported-by-paddle
- Paddle, payout (bank, PayPal, Payoneer): https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts dan https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid
- Paddle, verifikasi webhook: https://developer.paddle.com/webhooks/signature-verification
- Lemon Squeezy, supported countries (juga pengumuman tutup): https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- Lemon Squeezy tutup 31 Mar 2027: https://mjtsai.com/blog/2026/11/19/lemon-squeezy-shutting-down/ dan https://checkoutpage.com/blog/lemon-squeezy-shutting-down
- Xendit recurring: https://docs.xendit.co/credit-cards/subscriptions , https://www.xendit.co/en/products/recurring/
- Xendit/Midtrans bukan merchant of record: https://dodopayments.com/blogs/xendit-alternatives , https://dodopayments.com/blogs/midtrans-alternatives (blog vendor, bukan sumber resmi)

## 2. Apa yang sudah dibangun

- **Database** (`apps/saas/supabase/migrations/20261126200000_billing.sql`, satu-tempel:
  `apps/saas/supabase/catch-up/2026-11-26-billing.sql`):
  - `app_settings` (`billing_enabled`, default `false`).
  - `subscriptions` (satu per workspace): provider, id customer/langganan, status, plan `pro`, `price_tier`
    founding/normal, `quantity` = situs dibayar, `current_period_end`, `cancel_at`. Anggota workspace bisa
    membaca; menulis hanya service role (webhook).
  - `billing_events`: setiap webhook tersimpan sekali (unik per provider + event id), payload minimal (id,
    status, kuantitas, price id, tanggal). **Tidak pernah data kartu.**
  - `founding_seats`: 200 kursi. Saat checkout dimulai kursi ditahan 1 jam (supaya dua checkout tidak
    berebut kursi terakhir), aktif saat webhook masuk, dilepas saat langganan berakhir. Diambil di bawah
    advisory lock: batas 200 aman walau bersamaan.
  - Plan efektif workspace: langganan aktif (trialing/active/past_due) > override di ops panel
    (`account_plans` pemilik workspace: pro/pro_beta/founding = tanpa batas situs) > free (1 situs).
- **Edge Function `billing`** (`apps/saas/supabase/functions/billing/`): `?route=checkout`, `?route=portal`,
  `?route=webhook`. Checkout hanya untuk owner/admin workspace, kuantitas = jumlah situs, memilih price
  founding/normal. Webhook memverifikasi tanda tangan Paddle (HMAC-SHA256, maks 5 menit), idempoten.
- **Panel**: Settings → Plan and billing → halaman Billing (`#/app/billing`). Saat mati: "Free during the
  beta". Saat hidup: plan, situs dipakai vs dibayar, harga, Upgrade, Manage billing (invoice ada di portal).
- **Ops panel**: status billing, kursi founding dari langganan nyata, langganan per user.
- **PostHog**: `checkout_started`, `subscription_activated` (id dan plan saja).

## 3. Yang terjadi pada pengguna

- **Selama mati (sekarang)**: tidak ada perubahan apa pun.
- **Saat dinyalakan**:
  - Workspace dengan 1 situs: tetap gratis, tidak ada yang berubah.
  - Workspace dengan >1 situs tanpa Pro: **tidak ada data yang dihapus.** Situs tertua tetap berjalan; situs
    lainnya berhenti menerima komentar dan balasan **baru** (script tetap tampil; reviewer melihat pesan
    error saat mengirim). Tim tetap bisa membaca, resolve, ekspor CSV dan menghapus semuanya. Membuat situs
    baru butuh ruang di plan.
  - User yang Anda beri override (Pro beta / Founding / Pro) di ops panel: tanpa batas situs.
- **Setelah langganan**: batas = kuantitas yang dibayar. Tambah situs lewat Manage billing (ubah kuantitas).
- **Pembayaran gagal** (`past_due`): masih dihitung aktif (masa tenggang Paddle). **Dibatalkan**
  (`canceled`): kembali Free, kursi founding dilepas, data tetap.

Saran: sebelum menyalakan, kirim email ke semua pengguna minimal 14 hari sebelumnya, dan beri Pro beta
gratis beberapa bulan ke pengguna awal lewat ops panel (Set plan).

## 4. Langkah setup (sekali)

1. **Daftar Paddle** (https://www.paddle.com) sebagai penjual dari Indonesia; selesaikan verifikasi
   (identitas, website, kebijakan refund). Buat juga akun **sandbox** (https://sandbox-vendors.paddle.com)
   untuk uji coba.
2. **Produk dan harga** (lakukan di sandbox dulu, lalu ulangi di live):
   - Catalog → Products → New: "ourhunch Pro".
   - Price 1 "Pro per site": $4.80 USD, bulanan, quantity min 1, max 1000 → catat id `pri_…` (NORMAL).
   - Price 2 "Pro per site — founding": $2.00 USD, bulanan, quantity min 1, max 1000 → catat id (FOUNDING).
3. **Default payment link**: Checkout → Checkout settings → Default payment link =
   `https://ourhunch.com/app` (domain Anda harus disetujui Paddle). Halaman `/app` memuat Paddle.js hanya
   ketika alamatnya berisi `?_ptxn=…`.
4. **Client-side token**: Developer tools → Authentication → buat client-side token (`test_…` untuk
   sandbox, `live_…` untuk live). Tambahkan di Vercel → Environment Variables: `VITE_PADDLE_CLIENT_TOKEN`
   (token ini publik, aman di app), lalu redeploy.
5. **API key**: Developer tools → Authentication → API keys → buat key dengan izin transactions (write),
   customers (write), customer portal sessions (write), subscriptions (read).
6. **Webhook**: Developer tools → Notifications → New destination:
   - URL: `https://<project-ref>.supabase.co/functions/v1/billing?route=webhook`
   - Events: `subscription.created`, `subscription.updated`, `subscription.activated`,
     `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`,
     `subscription.trialing`.
   - Catat secret key-nya.
7. **Secrets di Supabase** (Dashboard → Edge Functions → Secrets; jangan pernah di repository atau chat):
   - `BILLING_PROVIDER` = `paddle`
   - `BILLING_SANDBOX` = `true` (uji coba) / hapus atau `false` (live)
   - `BILLING_API_KEY` = API key Paddle
   - `BILLING_WEBHOOK_SECRET` = secret webhook
   - `BILLING_PRICE_FOUNDING` = id price founding
   - `BILLING_PRICE_NORMAL` = id price normal
   - `BILLING_ENABLED` = `false` dulu
8. **Database**: tempel `apps/saas/supabase/catch-up/2026-11-26-billing.sql` di SQL editor → Run. (Tidak
   menyalakan apa pun.)
9. **Deploy function** lewat Dashboard → Edge Functions → Deploy a new function → nama `billing`, dengan
   **empat file** dari `apps/saas/supabase/functions/billing/`: `index.ts`, `handler.ts`, `paddle.ts`,
   `provider.ts` (`test.ts` tidak perlu). Matikan **Verify JWT** untuk function ini (webhook tidak punya token
   user; checkout dan portal memeriksa token sendiri). Dengan CLI:
   `supabase functions deploy billing --no-verify-jwt`.

## 5. Uji coba (sandbox, tanpa uang sungguhan)

Pakai project Supabase staging bila ada. Kalau hanya ada satu project, lakukan saat sepi:
1. Secrets sandbox (langkah 7) + `BILLING_ENABLED` = `true`.
2. SQL: `update public.app_settings set value = 'true' where key = 'billing_enabled';`
3. Login dengan akun uji → Settings → Billing → Upgrade → bayar dengan kartu uji Paddle
   (`4242 4242 4242 4242`, tanggal kedaluwarsa di masa depan, CVC apa saja).
4. Cek: halaman Billing menampilkan Pro; `select * from subscriptions;` ada barisnya;
   `select * from billing_events order by id desc limit 5;`; ops panel menunjukkan kursi founding 1/200.
5. Manage billing → ubah kuantitas → halaman Billing ikut berubah. Batalkan → kembali Free.
6. Kirim ulang event yang sama dari Paddle (Notifications → Replay): hasilnya `duplicate`, tidak berubah.
7. Matikan lagi bila belum siap: `update public.app_settings set value = 'false' where key = 'billing_enabled';`
   lalu hapus langganan uji: `delete from subscriptions where workspace_id = '<workspace uji>';` dan
   `delete from founding_seats where workspace_id = '<workspace uji>';`.

## 6. Checklist go-live

- [ ] Akun Paddle live terverifikasi, payout (rekening bank) diisi.
- [ ] Produk + 2 price dibuat di **live**; secrets diganti ke id live; `BILLING_SANDBOX` dihapus.
- [ ] Webhook live dibuat; `BILLING_WEBHOOK_SECRET` live.
- [ ] `VITE_PADDLE_CLIENT_TOKEN` = `live_…` di Vercel, redeploy.
- [ ] Domain disetujui Paddle; default payment link `https://ourhunch.com/app`.
- [ ] Bila ada CSP di `vercel.json`: `cdn.paddle.com` (script), `buy.paddle.com` dan
      `sandbox-buy.paddle.com` (frame), `*.paddle.com` (connect) diizinkan.
- [ ] Terms dan Privacy menyebut Paddle sebagai reseller/merchant of record dan kebijakan refund.
- [ ] Teks website (apps/landing) dan `products.ts` tidak lagi bilang "nothing is billed today".
- [ ] Email pengumuman ke semua pengguna ≥ 14 hari sebelumnya; override Pro beta untuk yang dijanjikan.

## 7. Menyalakan

1. Supabase secret `BILLING_ENABLED` = `true`.
2. SQL editor: `update public.app_settings set value = 'true', updated_at = now() where key = 'billing_enabled';`

Mematikan lagi: set keduanya kembali ke `false`. Tidak ada data yang hilang; langganan yang sudah ada tetap
ditagih oleh Paddle sampai dibatalkan (batalkan di Paddle bila perlu).

## 8. Tes

- SQL: `apps/saas/supabase/tests/billing_test.sql` (jalan lewat `tests/run.sh`): RLS, plan efektif, batas 200
  founding, event idempoten dan urutan, batas situs hanya saat hidup, ops.
- Function: dari `apps/saas`:
  `npx esbuild supabase/functions/billing/test.ts --bundle --platform=node --format=esm --outfile=/tmp/billing-test.mjs && node /tmp/billing-test.mjs`
