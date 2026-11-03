# Deploy Live Monitor ke VM Ubuntu

Panduan ini untuk deploy lewat GitHub Actions self-hosted runner di VM Ubuntu Anda, memakai Docker Compose. Tidak ada yang berjalan di VM sampai Anda sendiri menjalankan workflow-nya.

## Yang berjalan

Tiga container, semuanya diatur `docker-compose.yml`:

| Container | Fungsi | Terbuka ke luar? |
| --- | --- | --- |
| `live-monitor` | Nginx: menyajikan dashboard dan meneruskan `/api` ke server | Hanya `127.0.0.1:5177` (port bisa diubah) dan network `n8n-network` |
| `live-monitor-api` | Server Node.js (pemeriksa live, bot Telegram, API) | Tidak. Hanya bisa dicapai dari container Nginx |
| `live-monitor-mongo` | MongoDB 7 | Tidak. Hanya bisa dicapai dari server |

Karena dashboard dan API lewat alamat yang sama, tidak perlu domain terpisah untuk API, dan cookie login bekerja tanpa pengaturan CORS tambahan.

## Persiapan satu kali di VM

1. Pastikan runner Anda berada di grup `docker` dan `docker compose version` berjalan (plugin Compose v2).
2. Pastikan network `n8n-network` ada: `docker network ls | grep n8n-network`.
3. Cek port 5177 bebas: `ss -tlnp | grep 5177`. Kalau terpakai, ganti `WEB_PORT` di langkah 5.
4. Buat folder konfigurasi di luar repo (supaya tidak terhapus saat runner membersihkan workspace):

```
sudo mkdir -p /opt/live-monitor/data
sudo chown -R $USER:$USER /opt/live-monitor
```

Jika runner berjalan sebagai pengguna lain, sesuaikan pemilik foldernya ke pengguna itu.

5. Buat `/opt/live-monitor/.env` dari `.env.production.example` di repo, lalu amankan:

```
cp .env.production.example /opt/live-monitor/.env
chmod 600 /opt/live-monitor/.env
nano /opt/live-monitor/.env
```

Isi yang wajib:

- `MONGO_USER`: huruf dan angka saja.
- `MONGO_PASSWORD`: **huruf dan angka saja**, minimal 12 karakter (karakter khusus merusak alamat sambungan MongoDB).
- `ADMIN_PASSWORD_HASH`: buat di komputer Anda dengan `cd server && npm install && npm run hash-password`, lalu salin barisnya.
- Kunci yang Anda pakai: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUBSCRIBER_BOT_TOKEN`. Kosongkan yang tidak dipakai.
- Jangan pakai tanda kutip pada nilai.

6. Salin sesi Bigo (jika Bigo dipakai): `cp bigo-session.json /opt/live-monitor/data/` lalu `chmod 644 /opt/live-monitor/data/bigo-session.json`.
7. Jika Anda punya data lama dari uji lokal (`db.json`), salin ke `/opt/live-monitor/data/db.json`. Saat MongoDB masih kosong, isinya dipindahkan otomatis.
8. Commit `package-lock.json` di folder `server` dan `fe` (hasil `npm install`). Workflow memeriksanya.

## Domain dan HTTPS

Arahkan reverse proxy yang sudah Anda pakai untuk domain lain ke dashboard ini:

- Jika proxy berjalan di VM yang sama (di luar Docker): tujuan `http://127.0.0.1:5177`.
- Jika proxy berjalan sebagai container di `n8n-network`: tujuan `http://live-monitor:80`.

Syaratnya:

- **HTTPS wajib.** Cookie login diberi tanda `Secure`, jadi login tidak akan jalan lewat `http://` biasa (kecuali `localhost`).
- Proxy harus meneruskan `X-Forwarded-For` dan `X-Forwarded-Proto`. Server membaca alamat IP asli dari dua lapis proxy (proxy Anda dan Nginx di container), sesuai `TRUST_PROXY=2`. Jika di depan Nginx container tidak ada proxy lain, ubah menjadi `TRUST_PROXY=1`.
- Pasang di domain yang Anda pilih, misalnya `live.domainanda.com`.

## Menjalankan deploy

1. Push repo ke GitHub (termasuk `.github/workflows/deploy-live-monitor.yml`).
2. Buka tab **Actions**, pilih **Deploy Live Monitor Production**, lalu **Run workflow**.
   - `run_tests`: jalankan uji sebelum membangun (disarankan).
   - `scan_images`: pindai image dengan Trivy. Hanya melapor, tidak menggagalkan deploy.
3. Workflow berjalan berurutan: periksa konfigurasi, validasi compose, uji, simpan image lama sebagai `previous`, bangun image, jalankan container, tunggu sampai sehat, uji `/api/health` lewat Nginx.
4. Jika ada langkah setelah build yang gagal, workflow menampilkan log dan mengembalikan image `previous` secara otomatis.

Pertama kali, build server memakan waktu lebih lama karena mengunduh Chromium (untuk memeriksa TikTok).

## Sesudah deploy

- `docker ps` menampilkan tiga container dengan status healthy.
- `docker logs live-monitor-api --tail 50` harus memuat "Live Monitor server berjalan" dan, jika bot pembeli aktif, "Bot pelanggan aktif".
- Buka domain Anda, login. Di **Settings**, baris Configuration storage harus berbunyi "MongoDB (server)".
- Halaman **Subscribers** menampilkan status bot pembeli.

## Pemeliharaan

- **Memperbarui sesi Bigo:** salin file baru ke `/opt/live-monitor/data/bigo-session.json`. Terbaca otomatis, tanpa restart.
- **Mengubah `.env`:** jalankan ulang workflow (atau `docker compose --env-file /opt/live-monitor/.env up -d` dari folder repo di runner) agar container dibuat ulang.
- **Cadangan MongoDB** (jalankan terjadwal dengan cron jika perlu):

```
docker exec live-monitor-mongo mongodump -u MONGO_USER -p MONGO_PASSWORD --authenticationDatabase admin --db live_monitor --archive --gzip > cadangan-$(date +%F).gz
```

- **Memulihkan cadangan:**

```
docker exec -i live-monitor-mongo mongorestore -u MONGO_USER -p MONGO_PASSWORD --authenticationDatabase admin --archive --gzip --drop < cadangan-TANGGAL.gz
```

- **Rollback manual:**

```
docker tag live-monitor-api:previous live-monitor-api:latest
docker tag live-monitor:previous live-monitor:latest
docker compose --env-file /opt/live-monitor/.env up -d --no-build
```

- **Jangan** menjalankan `docker compose down -v` atau menghapus volume `live_monitor_mongo`: itu menghapus seluruh data.
- Pantau memori dengan `docker stats`. Chromium memakai cukup banyak memori saat memeriksa banyak akun TikTok. Jika VM kewalahan, naikkan interval pemeriksaan TikTok di dashboard.

## Jika ada masalah

- **Workflow gagal di "Periksa konfigurasi":** pesannya menyebut isian mana yang kurang atau salah.
- **`api` tidak sehat:** `docker logs live-monitor-api`. Penyebab umum: sandi Mongo mengandung karakter khusus, atau `ADMIN_PASSWORD_HASH` kosong.
- **Login berhasil tetapi langsung keluar lagi:** akses lewat `http://`, atau proxy tidak meneruskan `X-Forwarded-Proto`.
- **Rate limit login mengunci semua orang:** `TRUST_PROXY` tidak sesuai jumlah proxy sehingga semua permintaan terbaca dari satu IP.
- **Akun TikTok gagal terus:** lihat log service di halaman detail platform TikTok.

## Yang belum teruji

Konfigurasi Nginx, skrip pemeriksa, perilaku server dengan MongoDB sungguhan, dan rantai proxy (cookie, IP asli, rate limit, cache) sudah saya uji. **Yang belum bisa saya uji dari sini** karena tidak ada Docker: build image (terutama pemasangan Chromium), `docker compose up`, dan workflow di runner Anda. Jalankan deploy pertama dengan memantau log, dan kabari saya jika ada langkah yang gagal.
