#!/usr/bin/env bash
set -euo pipefail

file="${1:?Pemakaian: check-env.sh <berkas .env>}"

fail() {
  echo "::error::$1"
  exit 1
}

read_key() {
  grep -E "^$1=" "$file" | head -n1 | cut -d= -f2- || true
}

[ -f "$file" ] || fail "Berkas $file tidak ada di VM. Buat dari .env.production.example (lihat DEPLOY.md)."

mongo_user="$(read_key MONGO_USER)"
mongo_password="$(read_key MONGO_PASSWORD)"
hash="$(read_key ADMIN_PASSWORD_HASH)"

[ -n "$mongo_user" ] || fail "MONGO_USER belum diisi di $file."
[[ "$mongo_user" =~ ^[A-Za-z0-9]+$ ]] || fail "MONGO_USER hanya boleh huruf dan angka."
[[ "$mongo_password" =~ ^[A-Za-z0-9]{12,}$ ]] || fail "MONGO_PASSWORD harus huruf dan angka saja, minimal 12 karakter."
[[ "$hash" == scrypt:* ]] || fail "ADMIN_PASSWORD_HASH belum diisi. Buat dengan 'npm run hash-password' di folder server."

mode="$(stat -c %a "$file")"
case "$mode" in
  *00) ;;
  *) echo "::warning::Izin $file adalah $mode. Disarankan chmod 600." ;;
esac

for lock in server/package-lock.json fe/package-lock.json; do
  [ -f "$lock" ] || fail "$lock tidak ada di repo. Jalankan npm install lalu commit file itu."
done

data_dir="$(read_key DATA_DIR)"
data_dir="${data_dir:-/opt/live-monitor/data}"
bigo_checker="$(read_key BIGO_CHECKER)"
if [ "${bigo_checker:-real}" = "real" ] && [ ! -f "$data_dir/bigo-session.json" ]; then
  echo "::warning::$data_dir/bigo-session.json tidak ada. Pemeriksaan akun Bigo akan gagal sampai file itu disalin."
fi

echo "Konfigurasi di $file lengkap."
