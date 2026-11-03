import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGO_TEST_URI
const skip = uri ? false : 'MONGO_TEST_URI tidak diisi (butuh MongoDB sungguhan)'
const dbName = `lm_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-mongo-'))
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'true'
process.env.MONGODB_DB = dbName
process.env.MONGODB_TIMEOUT_MS = '1500'

const store = await import('../src/store/db.js')
const subs = await import('../src/services/subscription.js')

const admin = skip ? null : new MongoClient(uri)
if (admin) await admin.connect()
const probe = () => admin?.db(dbName)
const ops = async () => (await admin.db('admin').command({ serverStatus: 1 })).opcounters
const delta = (a, b) => ({ insert: b.insert - a.insert, update: b.update - a.update, delete: b.delete - a.delete })

const open = async () => {
  process.env.MONGODB_URI = uri
  return store.initStore()
}
const reopen = async () => {
  await store.flushStore()
  await store.closeStore()
  return open()
}

test('MongoDB kosong: data awal dibuat, dokumen tersimpan per akun, dan indeks unik terpasang', { skip }, async () => {
  const state = await open()
  await store.flushStore()
  assert.equal(state.accounts.length, 10)
  assert.equal(await probe().collection('accounts').countDocuments(), 10)
  assert.equal(await probe().collection('runtime').countDocuments(), 10)
  assert.ok(await probe().collection('kv').findOne({ _id: 'config' }))
  const subIdx = await probe().collection('subscribers').indexes()
  const codeIdx = await probe().collection('codes').indexes()
  assert.ok(subIdx.some((i) => i.key.chatId === 1 && i.unique))
  assert.ok(codeIdx.some((i) => i.key.codeHash === 1 && i.unique))
  assert.equal(store.storageInfo().kind, 'mongo')
})

test('data bertahan setelah server dimulai ulang, termasuk urutan akun dan konfigurasi', { skip }, async () => {
  const state = store.getState()
  state.config.global.defaultCheckIntervalSeconds = 77
  state.accounts.unshift({ id: 'acc_baru', platformId: 'tiktok', username: 'paling_baru', displayName: 'Paling Baru', profileUrl: 'x', monitoringEnabled: true, origin: 'subscription' })
  state.runtime.acc_baru = { checking: false, lastStatus: 'live', lastChecked: 'a', lastSuccess: 'a', lastError: null, live: { title: 'T', startedAt: 'a', viewers: 3, simulated: false } }
  const before = JSON.parse(JSON.stringify(state))
  const reloaded = await reopen()
  assert.equal(reloaded.accounts[0].id, 'acc_baru')
  assert.deepEqual(reloaded.accounts.map((a) => a.id), before.accounts.map((a) => a.id))
  assert.deepEqual(reloaded.accounts, before.accounts)
  assert.equal(reloaded.config.global.defaultCheckIntervalSeconds, 77)
  assert.equal(reloaded.runtime.acc_baru.live.viewers, 3)
  assert.deepEqual(reloaded.platformRuntime, before.platformRuntime)
})

test('penyimpanan hanya menulis dokumen yang berubah', { skip }, async () => {
  const state = store.getState()
  await store.persistNow()
  await store.flushStore()
  const a = await ops()
  await store.persistNow()
  await store.flushStore()
  const idle = delta(a, await ops())
  assert.deepEqual(idle, { insert: 0, update: 0, delete: 0 })

  state.runtime.acc_baru.lastStatus = 'offline'
  await store.persistNow()
  await store.flushStore()
  const changed = delta(a, await ops())
  assert.equal(changed.update + changed.insert, 1)
  assert.equal(changed.delete, 0)
})

test('penghapusan akun dan pelanggan ikut terhapus di MongoDB', { skip }, async () => {
  const state = store.getState()
  const code = subs.createCodes({ label: 'uji' })[0].code
  const { subscriber } = subs.redeemCode(code, { chatId: 4242, name: 'Uji', username: 'uji' })
  await store.flushStore()
  assert.equal(await probe().collection('subscribers').countDocuments({ chatId: '4242' }), 1)
  const codeDoc = await probe().collection('codes').findOne({ status: 'redeemed' })
  assert.equal(JSON.stringify(codeDoc).includes(code), false)
  subs.deleteSubscriber(subscriber.id)
  state.accounts = state.accounts.filter((a) => a.id !== 'acc_baru')
  delete state.runtime.acc_baru
  await store.persistNow()
  await store.flushStore()
  assert.equal(await probe().collection('subscribers').countDocuments({ chatId: '4242' }), 0)
  assert.equal(await probe().collection('accounts').countDocuments({ _id: 'acc_baru' }), 0)
  assert.equal(await probe().collection('runtime').countDocuments({ _id: 'acc_baru' }), 0)
})

test('kode dan pelanggan bertahan setelah restart, dan kode yang sudah dipakai tetap tidak bisa dipakai lagi', { skip }, async () => {
  const code = subs.createCodes({ label: 'sisa' })[0].code
  const { subscriber } = subs.redeemCode(code, { chatId: 777, name: 'Sisa', username: 'sisa' })
  subs.addSelection(subscriber.id, 'tiktok', 'dipantau_sisa')
  const reloaded = await reopen()
  const back = reloaded.subscribers.find((s) => s.chatId === '777')
  assert.equal(back.selections.length, 1)
  assert.equal(back.maxAccounts, 3)
  assert.throws(() => subs.redeemCode(code, { chatId: 778 }), (e) => e.code === 'INVALID_CODE')
  assert.ok(reloaded.accounts.some((a) => a.username === 'dipantau_sisa'))
})

test('chatId yang sama tidak bisa tersimpan dua kali (indeks unik)', { skip }, async () => {
  await assert.rejects(() => probe().collection('subscribers').insertOne({ _id: 'duplikat', chatId: '777' }), /duplicate key/i)
})

test('data lama dari db.json dipindahkan sekali ke MongoDB yang kosong', { skip }, async () => {
  await store.flushStore()
  await store.closeStore()
  await admin.db(dbName).dropDatabase()
  const legacy = { config: { global: { appName: 'Lama', timezone: 'Asia/Jakarta', globalMonitoringEnabled: true, defaultCheckIntervalSeconds: 60, defaultRetryAttempts: 3, defaultRetryDelaySeconds: 10, defaultRequestTimeoutMs: 15000, maxConcurrentChecks: 5 }, platforms: {} }, accounts: [{ id: 'acc_lama', platformId: 'twitch', username: 'akun_lama', displayName: 'Akun Lama', profileUrl: 'x', monitoringEnabled: true }], runtime: { acc_lama: { checking: true, lastStatus: 'offline' } }, platformRuntime: {}, history: [{ id: 'h1', accountId: 'acc_lama', startAt: '2026-01-01T00:00:00.000Z', endAt: null }], recordings: [], logs: [] }
  fs.writeFileSync(process.env.DB_FILE, JSON.stringify(legacy))
  const state = await open()
  await store.flushStore()
  assert.equal(state.accounts[0].username, 'akun_lama')
  assert.equal(state.runtime.acc_lama.checking, false)
  assert.equal(state.config.platforms.bigo.checkIntervalSeconds, 180)
  assert.deepEqual(state.codes, [])
  assert.equal(await probe().collection('accounts').countDocuments(), 1)
  assert.equal(await probe().collection('history').countDocuments(), 1)
  assert.equal(fs.existsSync(process.env.DB_FILE), false)
  assert.equal(fs.existsSync(`${process.env.DB_FILE}.sudah-dipindah`), true)
  const again = await reopen()
  assert.equal(again.accounts.length, 1)
})

test('MongoDB tidak terjangkau: gagal dengan pesan jelas tanpa membocorkan kata sandi', { skip }, async () => {
  await store.closeStore()
  process.env.MONGODB_URI = 'mongodb://pengguna:rahasia123@127.0.0.1:1/x'
  await assert.rejects(() => store.initStore(), (e) => /Tidak dapat terhubung ke MongoDB/.test(e.message) && !e.message.includes('rahasia123'))
})

test.after(async () => {
  if (!admin) return
  await store.closeStore().catch(() => {})
  await admin.db(dbName).dropDatabase().catch(() => {})
  await admin.close()
})
