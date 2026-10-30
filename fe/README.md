# Live Monitor

Dashboard monitoring live streaming multi-platform (TikTok, Shopee Live, YouTube Live, Instagram Live, Twitch). Tahap ini hanya frontend dengan mock data dan mock service. Tidak ada backend dan tidak ada permintaan jaringan ke platform mana pun.

## Menjalankan

```
npm install
npm run dev
npm run check
```

`npm run check` menjalankan uji konsistensi logika konfigurasi dan store (tanpa browser).

## Struktur

```
src/
  api/          pintu tunggal ke data; ganti isinya dengan HTTP saat backend siap
  app/          router
  components/   layout, common, accounts, platforms, configuration, notifications, recordings
  config/       defaults, configurationManager, configDiff
  data/         data dummy
  pages/        Overview, LiveAccounts, Platforms, PlatformDetails, LiveHistory, Recordings, Notifications, Settings
  services/     implementasi mock di balik api/
  store/        appStore (Zustand)
  utils/        effectiveConfig, formatters, validators
scripts/        consistency-check.mjs
```

## Aturan konfigurasi

- Interval pemeriksaan: Account > Platform > Global, dihitung di `utils/effectiveConfig.js`.
- Akun diperiksa otomatis hanya jika global monitoring, service platform, monitoring platform, dan monitoring akun semuanya aktif.
- Status akun tidak dianggap Offline saat pemeriksaan gagal, service mati, atau global monitoring dijeda. Statusnya ditampilkan Unknown.
- Konfigurasi tersimpan (persisted), konfigurasi efektif, status runtime, dan status terakhir dipisahkan.

## Yang perlu dihubungkan ke backend Node.js

| Frontend | Endpoint rancangan |
| --- | --- |
| `api/accountsApi.js` | `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id`, `PATCH /api/accounts/:id/monitoring` |
| `api/monitoringApi.js` | `POST /api/accounts/:id/check`, `POST /api/platforms/:platform/check`, `POST /api/platforms/:platform/restart`, `POST /api/monitoring/check-all`, `GET /api/monitoring/status` |
| `api/platformsApi.js` | `GET /api/platforms`, `GET /api/platforms/:platform`, `PATCH /api/platforms/:platform/config` |
| `api/settingsApi.js` | `GET/PATCH /api/config` |
| `api/notificationsApi.js` | `GET/PATCH /api/notifications/settings` |
| `api/recordingsApi.js` | `GET /api/recordings` |
| riwayat live (saat ini dibaca dari store) | `GET /api/history` |

Saat backend tersedia, server menjadi sumber kebenaran konfigurasi dan status runtime. localStorage hanya cadangan sementara. Token Telegram dan kredensial lain harus tetap di sisi server, dan validasi serta otorisasi wajib dilakukan di backend.

## Mode server

Tanpa konfigurasi, aplikasi berjalan dengan data dummy (mock mode). Untuk memakai backend:

```
cp .env.example .env
npm run dev
```

Isi `VITE_API_URL` dengan alamat server (default `http://localhost:4000`). Jika server tidak terjangkau, banner muncul dan data terakhir tetap ditampilkan.

`npm run check:integration` menjalankan server sementara di port 4010 lalu menguji seluruh aksi frontend terhadap server asli. Perintah ini membutuhkan `npm install` di folder `server`.

Yang masih mock walau server aktif: tombol Test notification, aksi Cancel/Retry rekaman, dan daftar rekaman (server belum menyimpan rekaman).

## Login

Di mode server, aplikasi meminta login admin. Atur kata sandi di `server/.env` (lihat README server). Tombol keluar ada di topbar. Jika sesi berakhir, aplikasi kembali ke halaman login.
