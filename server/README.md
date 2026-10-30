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
- `GET /api/history`, `GET /api/recordings`, `GET/PATCH /api/notifications/settings`
- `GET /api/health`

Error selalu berbentuk `{ "error": { "code", "message", "details" } }`.

## Aturan

- Interval: Account > Platform > Global. Akun diperiksa otomatis hanya jika global monitoring, service, monitoring platform, dan monitoring akun semuanya aktif.
- Pemeriksaan gagal tidak mengubah status live akun. Tiga kegagalan berturut-turut membuat service platform berstatus offline.
- Validasi dilakukan di server, termasuk batas angka dan kunci yang tidak dikenal.

## Mengganti checker dummy

Edit `src/services/checkers.js`. Setiap platform punya fungsi `(account, previousRuntime) => { status, live }` yang melempar error jika pemeriksaan gagal.
