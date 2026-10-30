import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
}

const { DEFAULT_CONFIG } = await import('../src/config/defaults.js')
const { resolveEffectiveConfig, getEligibility, getDisplayStatus, computeStats, getGlobalStatus } = await import('../src/utils/effectiveConfig.js')
const { importConfig, exportConfig, mergeWithDefaults, validateConfig } = await import('../src/config/configurationManager.js')
const { useAppStore } = await import('../src/store/appStore.js')

const results = []
const test = async (name, fn) => {
  try {
    await fn()
    results.push([true, name])
  } catch (error) {
    results.push([false, `${name}: ${error.message}`])
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v))
const acc = (platformId, custom) => ({ id: platformId + (custom || 'x'), platformId, monitoringEnabled: true, useCustomCheckInterval: !!custom, customCheckIntervalSeconds: custom || null })

await test('prioritas interval Account > Platform > Global', () => {
  const cfg = clone(DEFAULT_CONFIG)
  cfg.global.defaultCheckIntervalSeconds = 60
  cfg.platforms.tiktok.checkIntervalSeconds = 30
  assert.equal(resolveEffectiveConfig(acc('tiktok', 15), cfg).checkIntervalSeconds, 15)
  assert.equal(resolveEffectiveConfig(acc('tiktok'), cfg).checkIntervalSeconds, 30)
  assert.equal(resolveEffectiveConfig(acc('youtube'), cfg).checkIntervalSeconds, 60)
})

await test('mengubah interval global hanya memengaruhi akun tanpa override', () => {
  const cfg = clone(DEFAULT_CONFIG)
  cfg.global.defaultCheckIntervalSeconds = 90
  assert.equal(resolveEffectiveConfig(acc('tiktok', 15), cfg).checkIntervalSeconds, 15)
  assert.equal(resolveEffectiveConfig(acc('tiktok'), cfg).checkIntervalSeconds, 30)
  assert.equal(resolveEffectiveConfig(acc('youtube'), cfg).checkIntervalSeconds, 90)
})

await test('eligibility mengikuti empat syarat', () => {
  const cfg = clone(DEFAULT_CONFIG)
  assert.equal(getEligibility(acc('twitch'), cfg).eligible, true)
  cfg.platforms.instagram.serviceEnabled = false
  assert.equal(getEligibility(acc('instagram'), cfg).eligible, false)
  assert.equal(getEligibility(acc('twitch'), cfg).eligible, true)
  const off = { ...acc('twitch'), monitoringEnabled: false }
  assert.equal(getEligibility(off, cfg).eligible, false)
  cfg.global.globalMonitoringEnabled = false
  assert.equal(getEligibility(acc('twitch'), cfg).eligible, false)
})

await test('service offline atau mati membuat status live menjadi unknown, bukan offline', () => {
  const s = useAppStore.getState()
  const cfg = clone(s.config)
  const live = s.accounts.find((a) => s.runtime[a.id].lastStatus === 'live' && a.platformId === 'twitch')
  assert.equal(getDisplayStatus(live, s.runtime, s.platformRuntime, cfg), 'live')
  const down = { ...s.platformRuntime, twitch: { ...s.platformRuntime.twitch, status: 'offline' } }
  assert.equal(getDisplayStatus(live, s.runtime, down, cfg), 'unknown')
  cfg.platforms.twitch.serviceEnabled = false
  assert.equal(getDisplayStatus(live, s.runtime, s.platformRuntime, cfg), 'unknown')
})

await test('statistik konsisten dengan data akun', () => {
  const s = useAppStore.getState()
  const st = computeStats(s.accounts, s.runtime, s.platformRuntime, s.config)
  assert.equal(st.total, s.accounts.length)
  assert.equal(st.live + st.offline + st.unknown + st.disabled, st.total)
})

await test('status global: partial bila ada service tidak online, stopped bila dimatikan', () => {
  const s = useAppStore.getState()
  assert.equal(getGlobalStatus(s.config, s.platformRuntime), 'partial')
  const cfg = clone(s.config)
  cfg.global.globalMonitoringEnabled = false
  assert.equal(getGlobalStatus(cfg, s.platformRuntime), 'stopped')
})

await test('tambah akun memperbarui total dan platform terkait', async () => {
  const before = useAppStore.getState().accounts.length
  await useAppStore.getState().addAccount({ platformId: 'twitch', profileUrl: '', username: 'uji_akun', displayName: 'Uji Akun', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: '', autoRecording: null, notifyEnabled: null, notifyOnStart: null, notifyOnEnd: null, notes: '' }, 'uji_akun')
  const s = useAppStore.getState()
  assert.equal(s.accounts.length, before + 1)
  assert.equal(s.runtime[s.accounts[0].id].lastStatus, 'unknown')
})

await test('hapus akun tidak menghapus riwayat live', async () => {
  const s = useAppStore.getState()
  const target = s.history[0].accountId
  const histBefore = s.history.length
  await s.deleteAccount(target)
  const after = useAppStore.getState()
  assert.equal(after.accounts.some((a) => a.id === target), false)
  assert.equal(after.history.length, histBefore)
})

await test('nonaktifkan monitoring mengubah status menjadi disabled, bukan offline', async () => {
  const s = useAppStore.getState()
  const target = s.accounts.find((a) => a.monitoringEnabled)
  await s.setAccountMonitoring(target.id, false)
  const after = useAppStore.getState()
  const a = after.accounts.find((x) => x.id === target.id)
  assert.equal(getDisplayStatus(a, after.runtime, after.platformRuntime, after.config), 'disabled')
})

await test('pemeriksaan gagal tidak mengubah status akun dan Last Success', async () => {
  const realRandom = Math.random
  Math.random = () => 0
  const before = useAppStore.getState().runtime
  await useAppStore.getState().checkAllEnabled()
  Math.random = realRandom
  const after = useAppStore.getState().runtime
  const ids = Object.keys(before).filter((id) => useAppStore.getState().accounts.find((a) => a.id === id && a.monitoringEnabled))
  for (const id of ids) {
    if (!after[id].lastChecked || before[id].lastStatus === undefined) continue
    assert.equal(after[id].lastStatus, before[id].lastStatus)
    assert.equal(after[id].lastSuccess, before[id].lastSuccess)
  }
})

await test('check platform yang offline dibatalkan tanpa mengubah akun', async () => {
  const before = JSON.stringify(useAppStore.getState().runtime)
  await useAppStore.getState().checkPlatform('instagram')
  assert.equal(JSON.stringify(useAppStore.getState().runtime), before)
})

await test('menonaktifkan satu service tidak mengubah konfigurasi platform lain', async () => {
  const before = JSON.stringify(useAppStore.getState().config.platforms.tiktok)
  await useAppStore.getState().setServiceEnabled('shopee', false)
  assert.equal(JSON.stringify(useAppStore.getState().config.platforms.tiktok), before)
  assert.equal(useAppStore.getState().config.platforms.shopee.serviceEnabled, false)
})

await test('export lalu import menghasilkan konfigurasi yang sama', () => {
  const cfg = useAppStore.getState().config
  const result = importConfig(exportConfig(cfg))
  assert.equal(result.ok, true)
  assert.deepEqual(result.config, cfg)
})

await test('import menolak interval nol, negatif, dan JSON rusak', () => {
  const bad = clone(DEFAULT_CONFIG)
  bad.global.defaultCheckIntervalSeconds = 0
  assert.equal(importConfig(JSON.stringify({ config: bad })).ok, false)
  bad.global.defaultCheckIntervalSeconds = -5
  assert.equal(importConfig(JSON.stringify({ config: bad })).ok, false)
  assert.equal(importConfig('{rusak').ok, false)
})

await test('konfigurasi lama dilengkapi default baru tanpa error', () => {
  const old = clone(DEFAULT_CONFIG)
  delete old.global.notificationDefaults
  delete old.global.recordingDefaults
  delete old.platforms.tiktok.notificationOverrides
  const merged = mergeWithDefaults(old)
  assert.deepEqual(validateConfig(merged), [])
  assert.ok(merged.global.notificationDefaults.enabled !== undefined)
  assert.deepEqual(merged.platforms.tiktok.notificationOverrides, {})
})

await test('simpan, reset, dan draft tidak saling menimpa', async () => {
  const s = useAppStore.getState()
  s.setDraftGlobal({ defaultCheckIntervalSeconds: 120 })
  assert.equal(useAppStore.getState().config.global.defaultCheckIntervalSeconds !== 120, true)
  s.discardDraft()
  assert.equal(useAppStore.getState().draft.global.defaultCheckIntervalSeconds, useAppStore.getState().config.global.defaultCheckIntervalSeconds)
  await useAppStore.getState().resetConfig()
  assert.deepEqual(useAppStore.getState().config, DEFAULT_CONFIG)
})

const failed = results.filter(([ok]) => !ok)
results.forEach(([ok, name]) => console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}`))
console.log(`\n${results.length - failed.length} lulus, ${failed.length} gagal`)
process.exit(failed.length ? 1 : 0)
