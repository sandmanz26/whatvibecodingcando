# Paket peluncuran Product Hunt

*Semua teks di bawah sudah dicek panjangnya dan sudah melewati roast (`ROAST.md`). Teks publik berbahasa Inggris karena audiens Product Hunt global.*

---

## 1. Kapan

- **Syarat sebelum meluncur:** Minggu 0–3 di `PLAN.md` selesai: domain final, screenshot di komentar, notifikasi email, ±50 pengguna, ±10 testimoni/feedback nyata, video demo.
- **Hari:** Selasa–Kamis kalau audiens hangat Anda sudah ±150+ orang; **Sabtu** kalau masih kecil (persaingan lebih rendah, peluang Top 5 lebih besar).
- **Jam:** 00:01 waktu Pasifik.
  - November–Maret (PST, UTC−8): **15:01 WIB**.
  - Maret–November (PDT, UTC−7): **14:01 WIB**.
- Peluncuran berlangsung 24 jam (sampai 15:00/14:00 WIB keesokan harinya).

---

## 2. Isi formulir

**Name:** ourhunch *(atau nama final — lihat ROAST #1)*

**Tagline (maks 60 karakter) — pilihan, urutan rekomendasi:**
1. `Client feedback and user tests on any live site` *(47)*
2. `Pin feedback on any website, then fix it with AI` *(48)*
3. `One script: comments, user tests and heatmaps` *(45)*

**Description (yang tampil di pratinjau: ±260 karakter):**
> One script tag adds pinned comments, voice notes and user tests to any website. Clients review with a link, no account. Every note carries the page, element and device, and copies as a prompt for your AI coder. Free in beta, then $2 a site.

*(240 karakter)*

**Links:** `https://<domain>/?utm_source=producthunt&utm_campaign=launch`

**Topics (pilih 3):** Developer Tools · Design Tools · User Experience *(alternatif: Productivity, SaaS)*

**Pricing:** Free (with paid plan) — "Free during beta; $2 per site per month after."

**Makers:** akun Anda. **Hunter:** tidak wajib — meluncur sendiri sudah biasa.

---

## 3. Maker comment pertama (pasang ≤ 5 menit setelah live)

> Hi Product Hunt 👋 I'm [Nama], from Indonesia.
>
> I build websites for clients, more and more with AI. Building got 10× faster; feedback didn't. Clients still send screenshots and voice notes on WhatsApp — "the button on the second page, on my phone, looks weird" — and I spend more time figuring out *which* button than fixing it.
>
> **ourhunch** is one script tag that puts the review on the product itself:
> - **Clients review with one link, no account.** They click the thing, type or record their voice.
> - **Every note knows where it is:** the page, the exact element and the device (browser, system, screen size).
> - **Copy fix prompt:** turn one comment, or all open ones, into a prompt for Cursor, Lovable or Claude Code.
> - **User tests from the same script:** usability tasks, 5-second tests and click heatmaps with people who agree to take part (webcam eye tracking too, labelled Labs — it's a webcam, not a lab).
> - Your normal visitors see nothing and load ~5 KB. The script never reads what people type into your forms.
>
> It's **free during the beta**, then **$2 per site per month** — we priced it for freelancers and small agencies with many client sites.
>
> What I'd love your honest take on:
> 1. What's missing before you'd use this with a real client?
> 2. Would you rather it send feedback to Jira/Linear, or straight to your AI coding tool (MCP)?
>
> I'll be here all day answering everything. Thank you for looking!

*(Sebelum dipakai: ganti `[Nama]`, dan **hapus baris yang belum benar** — mis. kalau screenshot sudah ada, tambahkan "Screenshots are captured automatically"; kalau belum, jangan sebut.)*

---

## 4. Gallery (1270 × 760 px, 6 gambar)

Gunakan **screenshot produk asli**, bukan ilustrasi AI. Latar putih/abu terang, satu pesan besar per gambar, teks ≥ 48 px agar terbaca di HP.

| # | Judul di gambar | Isi screenshot |
|---|---|---|
| 1 | **Feedback on your live site — not in WhatsApp** | Situs nyata dengan 3 pin oranye + dock widget di kanan bawah |
| 2 | **Clients review with one link. No account.** | Kiri: panel Reviewers → "Make link". Kanan: browser reviewer dengan kartu komentar terbuka |
| 3 | **Every note knows the page, element and device** | Panel Comments: satu komentar dengan baris "Chrome 131 · macOS · 1280×800", badge status |
| 4 | **Turn feedback into a prompt for your AI coder** | Teks prompt hasil *Copy open as AI prompt* di sebelah editor (Cursor/Lovable) |
| 5 | **User tests and heatmaps from the same script** | Hasil studi: tabel tugas (success %, waktu) + heatmap klik di atas halaman |
| 6 | **$2 a site. Free during the beta.** | Kartu harga Free / Pro dari landing page + "1 script tag" snippet |

**Thumbnail (240 × 240, boleh GIF < 3 MB):** logo panah oranye; animasi: pin jatuh ke tombol, muncul angka "1". Latar polos.

---

## 5. Video demo (45 detik) — skrip & daftar shot

Rekam layar asli (OBS/QuickTime), resolusi 1920×1080, tanpa musik keras; teks besar di layar; suara opsional. **Chat WhatsApp di detik 0–5 harus buatan sendiri atau di-blur** — jangan tampilkan nama/nomor/data klien asli.

| Detik | Layar | Teks / narasi |
|---|---|---|
| 0–5 | Chat WhatsApp penuh screenshot revisi | "Client feedback still lives in screenshots." |
| 5–10 | Menempel satu baris `<script>` di `index.html` | "Add one script tag." |
| 10–18 | Panel → Reviewers → Make link → kirim | "Send your client a link. No account." |
| 18–28 | Klien klik tombol, ketik komentar, rekam suara | "They click the thing and say what's wrong." |
| 28–34 | Panel Comments: komentar + baris perangkat | "You see the page, element and device." |
| 34–40 | *Copy open as AI prompt* → tempel ke editor AI | "Hand it to your AI coder." |
| 40–45 | Kartu harga + logo | "User tests too. $2 a site. Free in beta." |

---

## 6. Dua minggu sebelum (H-14 → H-1)

- [ ] Akun Product Hunt sudah aktif ≥ 2 minggu: follow, beri komentar berguna di 5–10 produk lain (bukan "congrats!", tapi masukan nyata).
- [ ] Siapkan semua teks & gambar di draft Product Hunt; **jadwalkan** post ke 00:01 PT.
- [ ] Buat **daftar pendukung** (spreadsheet): nama, kanal (WA/email/X), sudah pernah mencoba produk? Target 100–200 orang yang benar-benar kenal Anda/produk.
- [ ] Kirim pesan **H-3** ke daftar itu: "Kamis kami meluncur, boleh saya kirim link-nya?" (izin dulu — bukan spam).
- [ ] Siapkan video & GIF; uji di HP.
- [ ] Siapkan jawaban untuk 10 pertanyaan yang paling mungkin (bagian 8).
- [ ] Uji ulang alur daftar → onboarding → Open my site (`docs/TESTING.md` tes ⚡).
- [ ] Pastikan server siap: Supabase Pro, PostHog aktif, email terkirim.
- [ ] Tidur cukup; minta 1 teman membantu memantau komentar malam hari.

---

## 7. Hari H (jam WIB, contoh untuk PST)

| Jam WIB | Kegiatan |
|---|---|
| 14:30 | Cek situs, daftar akun uji, cek email terkirim. Buka draft PH. |
| **15:01** | Post live. **≤ 5 menit:** pasang maker comment (bagian 3). |
| 15:10 | Kirim ke daftar pendukung (template `COPY.md` §9): minta **dicoba dan dikomentari jujur**, bukan "upvote ya". |
| 15:30 | Post di X & LinkedIn (`COPY.md` §5–6), pin di profil. |
| 16:00–23:00 | Balas **setiap** komentar ≤ 30 menit. Jawab spesifik, akui kekurangan, catat ide. |
| 20:00 | (= 08:00 ET) Gelombang kedua: post ulang di X dengan satu hal yang dipelajari dari komentar. |
| 23:00 | (= 08:00 PT) Pagi di Amerika Barat: cek ulang dan balas. |
| 00:00–06:00 | Teman/pembantu memantau; jawab yang mendesak. |
| 06:00–14:00 | Balas komentar tersisa; post ringkas "6 jam terakhir" di X/LinkedIn. |
| 15:00 | Selesai. Screenshot hasil. |

**Jangan:** minta upvote secara langsung, membeli upvote, membuat akun palsu, mengirim link ke grup besar yang tidak kenal Anda (bisa membuat produk di-unfeature).

---

## 8. Jawaban siap pakai untuk komentar

**"How is this different from Marker.io / BugHerd?"**
> They're great for bigger teams (and priced per seat, $39–59+/month). We're built for freelancers and small agencies juggling many client sites: $2 per site, clients need no account, and usability tests and heatmaps come in the same script. If you need deep Jira workflows today, Marker.io is the safer pick — that's on our roadmap.

**"Vercel already has comments."**
> True, and if your whole team is on Vercel previews it's a good choice. On free plans every reviewer needs a Vercel account, and it's for preview deployments. Ours works on any host, on production, with a link and no account — and adds user tests and heatmaps.

**"Is it safe to put on my production site?"**
> Normal visitors load a ~5 KB check and see nothing; the widget only loads for reviewers you invite or study participants who agree. It lives in a shadow root (your CSS can't break it and vice versa), never reads form values, and you can switch it off from the panel without touching code.

**"$2 sounds unsustainable."**
> It's our founding price, locked for the first 200 customers. The normal price will be announced well ahead (planned $5 a site) — still a fraction of the alternatives. And your data is always exportable as CSV.

**"Does it have an MCP server / Jira integration?"**
> Not yet — today you copy feedback as a prompt or CSV. Which one would you use first: MCP into your editor, or Jira/Linear/GitHub issues? We're deciding the order from answers like yours.

**"Does it work with Lovable / Bolt / Webflow / WordPress / Next.js?"**
> Yes — it's one script tag. The Install page has steps for HTML, Vite, Next.js, WordPress/Webflow/Framer, and a prompt you can paste into your AI builder to add it for you.

**"How accurate is webcam eye tracking?"**
> Roughly where on the screen, not which word — that's why it's labelled Labs. Each participant calibrates first, poorly calibrated runs are left out of the heatmap, and the video never leaves their browser; only gaze points are kept.

**"What about privacy / GDPR?"**
> We don't record visitors who aren't reviewers or consenting participants, never record what's typed into fields, mask emails/phone numbers in labels, and you can mark anything `data-private`. Data can be deleted per comment, per study or all at once.

**"Is it open source?"** / **"Self-hosting?"**
> Not today. If self-hosting matters for you, tell us why — it helps us decide.

**Kritik keras / bug report:**
> Thank you — that's exactly what I need today. [Ulangi masalahnya dengan kata-kata Anda.] I've logged it; I'll reply here when it's fixed.

---

## 9. Setelah peluncuran (H+1 → H+14)

- [ ] Balas semua komentar yang tersisa; ucapkan terima kasih di X/LinkedIn dengan angka jujur.
- [ ] Pasang badge Product Hunt di landing page (kalau masuk Top 5).
- [ ] Email semua pendaftar baru: tanya satu hal ("apa yang membuat Anda mendaftar?").
- [ ] Perbaiki 3 masalah teratas dari komentar, umumkan perbaikannya (balas di thread PH).
- [ ] Tulis post Indie Hackers "What we learned launching on Product Hunt" (angka nyata).
- [ ] 1–2 minggu kemudian: **Show HN** (`COPY.md` §3).

---

## Sumber
[Product Hunt Launch Guide](https://www.producthunt.com/launch/preparing-for-launch) · [Help: how to post a product](https://help.producthunt.com/posting/how-to-post-a-product) · [LaunchPact 2026](https://www.launchpact.io/product-hunt-launch-strategy) · [daily.dev checklist](https://daily.dev/blog/product-hunt-launch-checklist-developer-tools/) · [Causo realistic playbook](https://hub.causo.ai/guides/product-hunt-launch-2026-realistic-playbook) · [Oakgen gallery checklist](https://oakgen.ai/blog/product-hunt-launch-gallery-and-assets-checklist) · [Vercel Comments docs](https://vercel.com/docs/comments)
