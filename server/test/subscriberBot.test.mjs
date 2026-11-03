import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-bot-'))
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'false'

const { loadState, getState } = await import('../src/store/db.js')
const subs = await import('../src/services/subscription.js')
const bot = await import('../src/services/subscriberBot.js')

loadState()
let calls = []
const api = async (method, params) => {
  calls.push({ method, params })
  return {}
}
const sent = () => calls.filter((c) => c.method === 'sendMessage')
const lastText = () => sent().at(-1)?.params.text || ''
const edited = () => calls.filter((c) => c.method === 'editMessageText').at(-1)?.params.text || ''
let uid = 0
const say = (chatId, text, from = { first_name: 'Budi', username: 'budi_tg' }) => bot.handleUpdate({ update_id: ++uid, message: { chat: { id: chatId, type: 'private' }, from, text } }, api)
const click = (chatId, data) => bot.handleUpdate({ update_id: ++uid, callback_query: { id: 'q1', data, message: { chat: { id: chatId }, message_id: 7 } } }, api)
const buttonId = (kind) => sent().at(-1).params.reply_markup.inline_keyboard[0][kind === 'y' ? 0 : 1].callback_data
const reset = () => {
  const s = getState()
  Object.assign(s, { codes: [], subscribers: [], accounts: [], runtime: {} })
  s.subscriptionSettings = { allowedPlatforms: ['tiktok', 'bigo'], defaultMaxAccounts: 3, defaultDurationDays: 30, platformCaps: { tiktok: 50, bigo: 30 }, changesPerWeek: 3, blocklist: [], contactText: 'Hubungi admin untuk membeli.' }
  bot.resetBotMemory()
  calls = []
}
const newCode = (opts = {}) => subs.createCodes({ label: 'uji', ...opts })[0].code
const subscribe = async (chatId = 1, opts = {}) => {
  await say(chatId, newCode(opts))
  calls = []
  return getState().subscribers.find((s) => s.chatId === String(chatId))
}

test('/start untuk orang baru: sambutan dengan teks admin, belum ada pelanggan', async () => {
  reset()
  await say(1, '/start')
  assert.match(lastText(), /Hubungi admin untuk membeli/)
  assert.equal(getState().subscribers.length, 0)
})

test('tautan aktivasi /start KODE menukar kode, mencatat nama, dan menjelaskan langkah berikutnya', async () => {
  reset()
  const code = newCode({ maxAccounts: 2, durationDays: 10 })
  await say(5, `/start ${code}`)
  const sub = getState().subscribers[0]
  assert.equal(sub.chatId, '5')
  assert.equal(sub.name, 'Budi')
  assert.equal(sub.telegramUsername, 'budi_tg')
  assert.equal(sub.maxAccounts, 2)
  assert.match(lastText(), /Kode diterima/)
  assert.match(lastText(), /Jatah: 2 akun/)
  assert.match(lastText(), /\/tambah/)
})

test('kode yang ditempel biasa (huruf kecil, spasi) juga dikenali; kode salah atau terpakai dijawab seragam', async () => {
  reset()
  const code = newCode()
  await say(1, code.toLowerCase().replace(/-/g, ' '))
  assert.match(lastText(), /Kode diterima/)
  await say(2, code)
  const reused = lastText()
  await say(2, 'LM-AAAA-BBBB-CCCC')
  assert.equal(lastText(), reused)
  assert.match(reused, /tidak valid atau sudah dipakai/)
  assert.equal(getState().subscribers.length, 1)
})

test('terlalu banyak kode salah mengunci chat itu, bahkan untuk kode yang benar', async () => {
  reset()
  for (let i = 0; i < 5; i += 1) await say(9, 'LM-AAAA-BBBB-CCCC')
  const valid = newCode()
  await say(9, valid)
  assert.match(lastText(), /Terlalu banyak kode salah/)
  assert.equal(getState().subscribers.length, 0)
  await say(10, valid)
  assert.match(lastText(), /Kode diterima/)
})

test('/tambah: konfirmasi dulu dengan tautan profil, akun baru dibuat hanya setelah "Ya"', async () => {
  reset()
  await subscribe(1)
  await say(1, '/tambah tiktok @Nadia.Putri')
  assert.match(lastText(), /TikTok @Nadia\.Putri/)
  assert.match(lastText(), /https:\/\/www\.tiktok\.com\/@Nadia\.Putri/)
  assert.equal(getState().accounts.length, 0)
  await click(1, buttonId('y'))
  assert.equal(getState().accounts.length, 1)
  assert.equal(getState().accounts[0].origin, 'subscription')
  assert.equal(getState().subscribers[0].selections.length, 1)
  assert.match(edited(), /Berhasil/)
})

test('"Batal", tombol milik chat lain, dan permintaan kedaluwarsa tidak mengubah apa pun', async () => {
  reset()
  await subscribe(1)
  await say(1, '/tambah bigo airah05')
  const yes = buttonId('y')
  const no = buttonId('n')
  await click(2, yes)
  assert.match(edited(), /kedaluwarsa/)
  assert.equal(getState().accounts.length, 0)
  await say(1, '/tambah bigo airah05')
  await click(1, buttonId('n'))
  assert.match(edited(), /Dibatalkan/)
  await click(1, no)
  assert.match(edited(), /kedaluwarsa/)
  assert.equal(getState().accounts.length, 0)
  void yes
})

test('/tambah menerima tautan profil dan menolak platform, argumen, dan akun yang tidak valid', async () => {
  reset()
  await subscribe(1)
  await say(1, '/tambah tiktok https://www.tiktok.com/@nadia.putri')
  assert.match(lastText(), /TikTok @nadia\.putri/)
  await say(1, '/tambah youtube abc')
  assert.match(lastText(), /Platform tidak dikenal/)
  await say(1, '/tambah tiktok')
  assert.match(lastText(), /Cara pakai/)
  await say(1, '/tambah tiktok a/b/c')
  assert.ok(sent().length >= 4)
  await say(1, '/tambah bigo a.b')
  assert.match(lastText(), /username/i)
})

test('jatah habis, duplikat, dan daftar blokir dijelaskan sebelum konfirmasi', async () => {
  reset()
  await subscribe(1, { maxAccounts: 1 })
  await say(1, '/tambah tiktok satu')
  await click(1, buttonId('y'))
  await say(1, '/tambah tiktok satu')
  assert.match(lastText(), /sudah ada di daftar/)
  await say(1, '/tambah tiktok dua')
  assert.match(lastText(), /Jatah akun Anda habis/)
  getState().subscriptionSettings.blocklist = ['bigo:dilarang']
  await subscribe(2)
  await say(2, '/tambah bigo Dilarang')
  assert.match(lastText(), /tidak dapat dipantau/)
})

test('bukan pelanggan atau sudah habis: diminta membeli atau memperpanjang', async () => {
  reset()
  await say(3, '/tambah tiktok x')
  assert.match(lastText(), /belum berlangganan/)
  await say(3, '/akun')
  assert.match(lastText(), /Hubungi admin/)
  const sub = await subscribe(4)
  sub.expiresAt = new Date(Date.now() - 1000).toISOString()
  await say(4, '/tambah tiktok x')
  assert.match(lastText(), /tidak aktif/)
  await say(4, '/akun')
  assert.match(lastText(), /tidak aktif/)
})

test('/hapus meminta konfirmasi, melepas akun, dan menghormati batas penggantian', async () => {
  reset()
  await subscribe(1, { maxAccounts: 5 })
  getState().subscriptionSettings.changesPerWeek = 1
  for (const u of ['satu', 'dua']) {
    await say(1, `/tambah tiktok ${u}`)
    await click(1, buttonId('y'))
  }
  await say(1, '/hapus tiktok tidakada')
  assert.match(lastText(), /tidak ada di daftar/)
  await say(1, '/hapus tiktok satu')
  assert.match(lastText(), /1 dari 1 penggantian|memakai 1 dari 1/)
  await click(1, buttonId('y'))
  assert.match(edited(), /Akun dilepas/)
  assert.equal(getState().subscribers[0].selections.length, 1)
  await say(1, '/hapus tiktok dua')
  await click(1, buttonId('y'))
  assert.match(edited(), /Batas penggantian akun/)
  assert.equal(getState().subscribers[0].selections.length, 1)
})

test('/akun menampilkan masa aktif, jatah, dan status live tiap akun', async () => {
  reset()
  await subscribe(1)
  await say(1, '/tambah tiktok nadia')
  await click(1, buttonId('y'))
  const account = getState().accounts[0]
  getState().runtime[account.id].lastStatus = 'live'
  await say(1, '/akun')
  assert.match(lastText(), /Langganan aktif sampai/)
  assert.match(lastText(), /Jatah akun: 1 dari 3/)
  assert.match(lastText(), /TikTok @nadia: sedang live/)
})

test('/notif_selesai mengubah pilihan pelanggan', async () => {
  reset()
  await subscribe(1)
  await say(1, '/notif_selesai')
  assert.match(lastText(), /mati/)
  await say(1, '/notif_selesai on')
  assert.equal(getState().subscribers[0].notifyEnd, true)
  await say(1, '/notif_selesai off')
  assert.equal(getState().subscribers[0].notifyEnd, false)
})

test('/hapusdata menghapus pelanggan setelah konfirmasi dan menjeda akun yang tak diikuti', async () => {
  reset()
  await subscribe(1)
  await say(1, '/tambah bigo airah05')
  await click(1, buttonId('y'))
  await say(1, '/hapusdata')
  await click(1, buttonId('y'))
  assert.match(edited(), /sudah dihapus/)
  assert.equal(getState().subscribers.length, 0)
  assert.equal(getState().accounts[0].monitoringEnabled, false)
})

test('pesan dari grup dan pesan non-teks diabaikan; teks acak dijawab petunjuk', async () => {
  reset()
  await bot.handleUpdate({ update_id: ++uid, message: { chat: { id: -1, type: 'group' }, from: {}, text: '/start' } }, api)
  await bot.handleUpdate({ update_id: ++uid, message: { chat: { id: 1, type: 'private' }, from: {}, sticker: {} } }, api)
  assert.equal(calls.length, 0)
  await say(1, 'halo')
  assert.match(lastText(), /Hubungi admin/)
  await subscribe(2)
  await say(2, 'halo')
  assert.match(lastText(), /\/bantuan/)
})

test('pollOnce memakai offset tersimpan, melewati pesan lama, dan menyimpan offset terakhir', async () => {
  reset()
  const state = getState()
  state.botOffset = 100
  let asked = null
  const fake = async (method, params) => {
    if (method === 'getUpdates') {
      asked = params
      return [{ update_id: 100, message: { chat: { id: 1, type: 'private' }, from: {}, text: '/start' } }, { update_id: 101, message: { chat: { id: 1, type: 'private' }, from: {}, text: '/bantuan' } }]
    }
    calls.push({ method, params })
    return {}
  }
  const handled = await bot.pollOnce(fake, { timeout: 1 })
  assert.equal(asked.offset, 101)
  assert.equal(handled, 1)
  assert.equal(state.botOffset, 101)
  assert.match(lastText(), /Perintah:/)
})

test('kesalahan tak terduga saat memproses dicatat dan tidak menghentikan bot', async () => {
  reset()
  const broken = async () => {
    throw new Error('Telegram mati')
  }
  await bot.handleUpdate({ update_id: ++uid, message: { chat: { id: 1, type: 'private' }, from: {}, text: '/bantuan' } }, broken)
  assert.ok(getState().logs.some((l) => l.message.includes('Bot pelanggan')))
})
