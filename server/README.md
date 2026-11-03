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

## Checker Twitch

Checker Twitch memakai API resmi Twitch (Helix, endpoint `Get Streams`) dengan app access token (client credentials). Tidak butuh browser.

1. Daftarkan aplikasi di https://dev.twitch.tv/console (gratis), lalu ambil Client ID dan buat Client Secret.
2. Isi di `.env` server:

```
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
```

3. Coba satu akun:

```
npm run try-twitch -- username_twitch
```

Aturan:

- Token diambil otomatis, dipakai ulang sampai hampir kedaluwarsa, dan diambil ulang sekali jika ditolak.
- Akun yang tidak ada dianggap pemeriksaan gagal (bukan offline). Keberadaan akun diverifikasi sekali, saat pertama kali ia tampak offline.
- Rate limit, kredensial salah, dan timeout menjadi pesan error di log service. Status akun tidak berubah.
- Username Twitch harus 4-25 karakter: huruf, angka, atau garis bawah.
- Client Secret tidak pernah dikirim ke browser dan disamarkan di pesan error.
- `TWITCH_CHECKER=dummy` mengembalikan Twitch ke data contoh.

## Checker YouTube

Checker YouTube memakai YouTube Data API v3 dengan API key (data publik, tanpa login Google).

1. Di https://console.cloud.google.com buat proyek, aktifkan **YouTube Data API v3**, lalu buat **API key** (Credentials, Create credentials, API key). Disarankan membatasi key hanya untuk YouTube Data API v3.
2. Isi di `.env` server:

```
YOUTUBE_CHECKER=real
YOUTUBE_API_KEY=...
```

3. Coba satu channel:

```
npm run try-youtube -- NamaHandle
```

Akun YouTube diisi dengan handle (tanpa @) atau ID channel yang diawali `UC`. Menempel URL profil `https://www.youtube.com/@handle` atau `https://www.youtube.com/channel/UC...` juga bisa. URL lama berbentuk `/c/nama` atau `/user/nama` tidak didukung.

Kuota: proyek Google mendapat 10.000 unit per hari secara default, dibagi semua key di proyek itu. Pencarian (`search.list`) memakan 100 unit per panggilan sehingga tidak dipakai di sini. Checker ini hanya memakai pembacaan 1 unit:

- Daftar 5 unggahan terbaru channel (1 unit), lalu detail video yang belum diketahui statusnya (1 unit). Video yang sudah pasti bukan live disimpan, jadi pemeriksaan berikutnya yang tidak ada video baru hanya 1 unit.
- Akun yang sedang live hanya 1 unit per pemeriksaan (memastikan video itu masih live).
- Handle diubah menjadi ID channel sekali (1 unit), lalu disimpan di memori sampai server di-restart.

Perkiraan: pemeriksaan tiap 60 detik menghabiskan sekitar 1.440 unit per akun per hari, jadi default 10.000 unit hanya cukup untuk sekitar 6 akun. Interval 180 detik cukup untuk sekitar 20 akun. Pemakaian hari ini tampil di halaman detail platform YouTube.

Aturan:

- Kuota habis: pemeriksaan gagal dengan pesan jelas dan berhenti memanggil YouTube sampai reset (tengah malam Waktu Pasifik). Status akun tidak berubah.
- API key salah, API belum diaktifkan, dan channel tidak ditemukan menjadi pesan error di log. Status akun tidak berubah.
- API key tidak pernah dikirim ke browser dan disamarkan di pesan error.
- Jika channel memiliki beberapa siaran live bersamaan, yang penontonnya terbanyak yang dipakai.
- `YOUTUBE_CHECKER=dummy` mengembalikan YouTube ke data contoh.
- Perilaku live yang belum pernah diuji pada YouTube sungguhan: siaran live yang baru mulai harus muncul di daftar unggahan channel. Jika pada channel Anda tidak muncul, kabari agar metodenya diganti.

## Checker Bigo Live

Bigo tidak punya API resmi. Checker ini membuka halaman `https://www.bigo.tv/<id>` di Chromium (browser yang sama dengan checker TikTok), lalu membaca balasan `getInternalStudioInfo` yang dikirim halaman itu sendiri, bersama sesi login Bigo yang sudah ada. Cara ini dipilih karena permintaan langsung tanpa browser tidak membawa token halaman, sehingga Bigo bisa menjawab tidak live atau tanpa URL stream untuk room yang sebenarnya live. Karena tidak resmi, bisa berhenti bekerja jika Bigo mengubah sistemnya.

Pemasangan:

0. Pastikan Chromium terpasang (sama seperti TikTok): `npx playwright install chromium`.
1. Salin `bigo-session.json` dari skrip lama ke `server/data/bigo-session.json` (atau atur lokasinya lewat `BIGO_SESSION_FILE` di `.env`). File ini berisi cookie login Anda: jangan di-commit dan jangan dibagikan. Folder `data` dan nama file ini sudah ada di `.gitignore`.
2. Coba satu akun:

```
npm run try-bigo -- id_bigo
```

3. Tambahkan akun Bigo lewat dashboard (platform Bigo Live, username berupa ID Bigo).

Aturan:

- Server hanya memasang cookie milik bigo.tv ke browser, dan membaca ulang file sesi otomatis saat file diganti, jadi memperbarui sesi tidak perlu me-restart server.
- Tiap pemeriksaan membuka halaman Bigo di konteks browser baru, jadi lebih lambat dari permintaan langsung (biasanya beberapa detik). Batas waktu bawaan Bigo untuk database baru 45 detik. Pada database yang sudah ada, nilai ini tetap mengikuti pengaturan lama (bawaan global 15 detik): naikkan batas waktu platform Bigo di halaman konfigurasi jika pemeriksaan sering gagal karena melewati batas waktu.
- `npm run try-bigo` juga menampilkan apakah Bigo mengirim URL stream (`adaUrlStream`), tanpa mencetak URL-nya.
- Jika Bigo menjawab sesi tidak valid, pemeriksaan dianggap gagal dengan pesan "Sesi login Bigo kedaluwarsa", bukan offline. Tiga kegagalan berturut-turut memicu notifikasi Service Failed. Login ulang dengan `login_bigo_manual.js`, lalu salin `bigo-session.json` yang baru.
- Bigo tidak mengirim judul atau jumlah penonton di endpoint ini (yang dikenal skrip lama hanya status live dan ID ruangan), jadi kartu live Bigo memakai judul umum dan tanpa penonton.
- ID Bigo yang tidak ada belum bisa dibedakan dari akun yang offline.
- Interval default Bigo 180 detik, sama seperti cron skrip lama.
- Tautan profil bawaan `https://www.bigo.tv/user/<id>` belum diverifikasi. Jika salah, ubah URL profil akunnya lewat tombol Edit.
- `BIGO_CHECKER=dummy` mengembalikan Bigo ke data contoh.
- Database lama otomatis dilengkapi pengaturan Bigo saat server dijalankan.
