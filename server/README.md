# Live Monitor Server

Backend Node.js + Express. Tahap ini: kerangka, API sesuai kontrak, scheduler, dan checker dummy. Belum ada koneksi nyata ke platform mana pun.

## Menjalankan

```
cp .env.example .env
npm install
npm run dev
```

Server berjalan di http://localhost:4000. Data tersimpan di `data/db.json` (dibuat otomatis, tidak masuk Git).

## Endpoint

- `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id`, `PATCH /api/accounts/:id/monitoring`, `POST /api/accounts/:id/check`
- `GET /api/platforms`, `GET /api/platforms/:platform`, `GET /api/platforms/:platform/logs`, `PATCH /api/platforms/:platform/config`, `POST /api/platforms/:platform/check`, `POST /api/platforms/:platform/restart`
- `GET/PATCH /api/config`
- `GET /api/monitoring/status`, `POST /api/monitoring/start`, `POST /api/monitoring/stop`, `POST /api/monitoring/check-all`
- `GET /api/logs`, `GET /api/history`, `GET /api/recordings`, `GET/PATCH /api/notifications/settings`
- `GET /api/health`

Error selalu berbentuk `{ "error": { "code", "message", "details" } }`.

## Aturan

- Interval: Account > Platform > Global. Akun diperiksa otomatis hanya jika global monitoring, service, monitoring platform, dan monitoring akun semuanya aktif.
- Pemeriksaan gagal tidak mengubah status live akun. Tiga kegagalan berturut-turut membuat service platform berstatus offline.
- Validasi dilakukan di server, termasuk batas angka dan kunci yang tidak dikenal.

## Mengganti checker dummy

Edit `src/services/checkers.js`. Setiap platform punya fungsi `(account, previousRuntime) => { status, live }` yang melempar error jika pemeriksaan gagal.

## Login admin

Semua endpoint di bawah `/api` (kecuali `/api/health` dan `/api/auth/*`) butuh login.

1. Buat hash kata sandi (minimal 10 karakter, diketik tersembunyi):

```
npm run hash-password
```

2. Salin baris `ADMIN_PASSWORD_HASH=...` ke `.env`. Server menolak berjalan jika hash ini belum diisi. Kata sandi asli tidak pernah disimpan.
3. Opsional: ubah `ADMIN_USERNAME` (default `admin`) dan `SESSION_TTL_HOURS` (default 12).

Cara kerjanya:

- Sesi memakai cookie `HttpOnly` dan `SameSite=Lax`. Token sesi acak, disimpan di memori server, dan bisa dicabut saat logout. Server di-restart berarti semua sesi berakhir.
- Permintaan yang mengubah data wajib membawa header `X-Requested-With: live-monitor` (perlindungan CSRF tambahan).
- Percobaan login salah dibatasi: 5 kali per kombinasi IP dan username, 20 kali per IP, dalam 15 menit. Lewat dari itu server menjawab 429.
- Untuk produksi lewat HTTPS isi `COOKIE_SECURE=true`. Jika server berada di belakang proxy (Nginx dan sejenisnya), isi `TRUST_PROXY=true` agar IP pengunjung terbaca benar.
- Cookie `SameSite=Lax` bekerja jika frontend dan server berada di situs yang sama (misalnya `localhost` dengan port berbeda, atau subdomain dari domain yang sama). Jika dipisah domain berbeda, perlu penyesuaian.

## Checker TikTok

Checker TikTok memakai browser Chromium (Playwright) untuk membuka `https://www.tiktok.com/@username/live`, lalu membaca data `SIGI_STATE` dari halaman, dengan cara yang sama seperti skrip live recorder lama.

Pemasangan sekali saja:

```
npm install
npx playwright install chromium
```

Coba satu akun dulu sebelum dipakai penuh:

```
npm run try-tiktok -- username
npm run try-tiktok -- username --dump
```

Perintah kedua menyimpan halaman ke `tiktok-dump.html` untuk diperiksa jika hasilnya tidak sesuai.

Aturan:

- Halaman tanpa data, data rusak, atau struktur tidak dikenali dianggap pemeriksaan gagal, bukan offline. Status akun tidak berubah, dan error tercatat di log service.
- Request timeout TikTok default 45 detik (membuka halaman lebih lambat dari API biasa).
- `TIKTOK_CHECKER=dummy` di `.env` mengembalikan checker TikTok ke data contoh. `SEED_DEMO=false` membuat database awal kosong (tanpa akun contoh); hapus `data/db.json` agar berlaku.
- Platform lain masih memakai checker dummy.
- Browser dibuka bersama dan dipakai ulang, lalu dimulai ulang setelah 300 halaman untuk menjaga memori.
- Jangan terlalu rapat: setiap pemeriksaan membuka satu halaman penuh. Untuk puluhan akun TikTok, interval 120 sampai 180 detik jauh lebih aman daripada 30 detik.

## Notifikasi Telegram

Server mengirim pesan Telegram untuk: live dimulai, live berakhir, service gagal, dan service pulih. Token bot hanya ada di `.env` server dan tidak pernah dikirim ke browser.

1. Isi di `.env` (boleh memakai bot dan chat ID yang sama dengan skrip live recorder lama):

```
TELEGRAM_BOT_TOKEN=token_dari_BotFather
TELEGRAM_CHAT_ID=id_chat_tujuan
```

2. Jika belum tahu chat ID: kirim satu pesan ke bot Anda, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` dan cari nilai `chat` → `id`.
3. Restart server, buka halaman Notifications, lalu tekan Test notification.

Aturan:

- Yang dikirim mengikuti pengaturan di halaman Notifications: preferensi global, override platform, lalu pengaturan per akun (akun yang diatur Aktif atau Mati mengalahkan keduanya).
- Pesan dikirim berurutan, minimal 1,1 detik antar pesan. Jika Telegram menjawab "terlalu cepat", server menunggu lalu mencoba sekali lagi.
- Service gagal dan service pulih dikirim hanya saat status berubah, dan paling sering sekali per 10 menit per platform, supaya tidak membanjiri chat jika koneksi naik-turun.
- Jika pengiriman gagal, kegagalannya tercatat di log service (token disamarkan) dan tidak mengganggu pemeriksaan.
- Notifikasi rekaman tidak dipakai dan disembunyikan dari halaman Notifications.
