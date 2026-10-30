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
