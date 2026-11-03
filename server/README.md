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

Bigo tidak punya API resmi. Checker ini memakai endpoint internal yang sama dengan skrip live recorder lama (`getInternalStudioInfo`) dan sesi login Bigo yang sudah ada. Karena tidak resmi, bisa berhenti bekerja jika Bigo mengubah sistemnya.

Pemasangan:

1. Salin `bigo-session.json` dari skrip lama ke `server/data/bigo-session.json` (atau atur lokasinya lewat `BIGO_SESSION_FILE` di `.env`). File ini berisi cookie login Anda: jangan di-commit dan jangan dibagikan. Folder `data` dan nama file ini sudah ada di `.gitignore`.
2. Coba satu akun:

```
npm run try-bigo -- id_bigo
```

3. Tambahkan akun Bigo lewat dashboard (platform Bigo Live, username berupa ID Bigo).

Aturan:

- Server hanya mengirim cookie milik bigo.tv ke Bigo, dan membaca ulang file sesi otomatis saat file diganti, jadi memperbarui sesi tidak perlu me-restart server.
- Jika Bigo menjawab sesi tidak valid, pemeriksaan dianggap gagal dengan pesan "Sesi login Bigo kedaluwarsa", bukan offline. Tiga kegagalan berturut-turut memicu notifikasi Service Failed. Login ulang dengan `login_bigo_manual.js`, lalu salin `bigo-session.json` yang baru.
- Bigo tidak mengirim judul atau jumlah penonton di endpoint ini (yang dikenal skrip lama hanya status live dan ID ruangan), jadi kartu live Bigo memakai judul umum dan tanpa penonton.
- ID Bigo yang tidak ada belum bisa dibedakan dari akun yang offline.
- Interval default Bigo 180 detik, sama seperti cron skrip lama.
- Tautan profil bawaan `https://www.bigo.tv/user/<id>` belum diverifikasi. Jika salah, ubah URL profil akunnya lewat tombol Edit.
- `BIGO_CHECKER=dummy` mengembalikan Bigo ke data contoh.
- Database lama otomatis dilengkapi pengaturan Bigo saat server dijalankan.

## Langganan (kode, pelanggan, pilihan akun)

Tahap 1: penyimpanan dan API admin. Bot Telegram pelanggan dan pengiriman notifikasi per pelanggan menyusul di tahap berikutnya.

Konsep:

- **Kode**: dibuat admin di halaman Subscribers (jatah akun dan masa aktif per kode). Bentuknya `LM-XXXX-XXXX-XXXX`, acak, sekali pakai. Kode asli hanya tampil sekali saat dibuat; server hanya menyimpan hash-nya. Kode yang belum dipakai bisa dibatalkan.
- **Pelanggan**: dibuat saat kode ditukar (lewat bot, tahap 2). Menukar kode lagi saat masih aktif memperpanjang masa aktif dan memakai jatah terbesar; setelah habis, langganan dimulai ulang dari sekarang.
- **Pilihan akun**: pelanggan memilih username TikTok atau Bigo sebanyak jatahnya. Akun baru otomatis masuk daftar pemantauan (`origin: subscription`). Jika tidak ada pelanggan aktif yang mengikutinya, pemeriksaan akun itu dijeda otomatis. Akun buatan admin tidak pernah dijeda otomatis.
- **Pengaturan**: platform yang boleh dipilih, kapasitas total per platform, batas penggantian akun per minggu, daftar blokir, dan teks sambutan bot. Semua diatur di halaman Subscribers.

Endpoint admin (butuh login): `GET /api/subscription/overview`, `POST /api/subscription/codes`, `POST /api/subscription/codes/:id/revoke`, `GET/PATCH /api/subscription/settings`, `PATCH/DELETE /api/subscription/subscribers/:id`, `POST/DELETE /api/subscription/subscribers/:id/selections`.

## Bot Telegram pembeli

Bot ini menerima kode dan perintah dari pembeli. Pakai **bot baru** (BotFather, `/newbot`) dengan token terpisah dari `TELEGRAM_BOT_TOKEN` (bot notifikasi pribadi Anda). Satu token tidak boleh dibaca oleh dua program sekaligus, jadi jangan pakai token yang masih dipakai skrip lain yang membaca pesan.

1. Isi `.env`: `SUBSCRIBER_BOT_TOKEN=token_bot_baru`
2. Restart server. Di log muncul "Bot pelanggan aktif: @namabot", dan halaman Subscribers menampilkan status bot serta tombol Salin tautan bot.
3. Buat kode di halaman Subscribers. Tiap kode punya tombol **Salin tautan** (`https://t.me/namabot?start=KODE`): pembeli cukup mengetuk tautan itu lalu Start, dan kodenya langsung ditukar.

Perintah pembeli:

- `/start` sambutan dan cara membeli (teks dari pengaturan langganan).
- Mengirim kode (boleh huruf kecil atau tanpa strip) menukar kode.
- `/akun` masa aktif, jatah, dan status live akun yang dipantau.
- `/tambah tiktok username` atau `/tambah bigo username` (username atau tautan profil boleh dipakai). Bot menampilkan tautan profil dan meminta konfirmasi sebelum akun ditambahkan.
- `/hapus tiktok username` melepas akun (dengan konfirmasi dan batas penggantian per minggu).
- `/notif_selesai on|off` kabar saat live berakhir.
- `/hapusdata` menghapus semua data pembeli (dengan konfirmasi).

Keamanan dan aturan:

- Bot hanya merespons chat pribadi. Pesan grup diabaikan.
- Kode salah dibatasi 5 kali per jam per chat. Setelah itu chat itu dikunci sementara, bahkan untuk kode yang benar.
- Bot memakai long polling, jadi tidak butuh alamat publik. Posisi pesan terakhir disimpan, sehingga pesan tidak diproses dua kali setelah server di-restart.
- Jika token bot dipakai program lain yang juga membaca pesan, status bot menampilkan peringatan dan bot mencoba lagi tiap 30 detik.
- Pengiriman notifikasi live ke pembeli belum aktif di tahap ini (tahap 3).

## Notifikasi ke pelanggan

Saat akun yang dipantau berubah dari tidak live menjadi live, server mengirim pesan ke semua pelanggan yang **aktif** dan memilih akun itu lewat bot pembeli. Pesan "live berakhir" hanya untuk pelanggan yang menyalakannya (`/notif_selesai on`). Notifikasi pelanggan berjalan terpisah dari pengaturan notifikasi admin di halaman Notifications.

Cara kerja:

- **Pengirim** memakai antrean sendiri: maksimal 25 pesan per detik secara keseluruhan dan 1 pesan per 1,1 detik per chat, mengikuti batas Telegram. Hingga 5 pesan dikirim bersamaan.
- Jika Telegram menjawab "terlalu cepat" (429), pesan dicoba ulang setelah waktu yang diminta. Gangguan jaringan dicoba sampai 3 kali.
- Jika pelanggan memblokir bot (atau chat tidak ditemukan), pelanggan ditandai **Bot diblokir** di halaman Subscribers dan tidak dikirimi apa pun lagi. Saat ia menulis ke bot lagi, tandanya hilang otomatis.
- **Pengingat**: 3 hari sebelum masa aktif habis, pelanggan dikirimi pengingat sekali per tanggal habis (tidak dikirim jika langganan baru saja dibeli atau diperpanjang kurang dari 12 jam).
- **Masa aktif habis**: pelanggan dikabari sekali, notifikasi berhenti, dan akun pilihannya tetap tersimpan. Akun milik pelanggan yang sudah tidak diikuti siapa pun dijeda otomatis. Saat pelanggan memperpanjang dengan kode baru, pemeriksaannya aktif kembali.
- Pemeriksaan masa aktif berjalan tiap 10 menit dan saat server dimulai.
- Statistik antrean (menunggu, terkirim, gagal sejak server dijalankan) tampil di halaman Subscribers.
