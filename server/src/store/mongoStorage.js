import { MongoClient } from 'mongodb'

const ARRAYS = ['accounts', 'history', 'recordings', 'logs', 'codes', 'subscribers']
const SINGLETONS = ['config', 'configSavedAt', 'platformRuntime', 'subscriptionSettings', 'botOffset']
const byText = (key, dir) => (a, b) => dir * String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
const SORTS = {
  history: byText('startAt', -1),
  recordings: byText('startedAt', -1),
  logs: byText('at', -1),
  codes: byText('createdAt', -1),
  subscribers: byText('createdAt', 1)
}

const redact = (text) => String(text).replace(/\/\/[^@/\s]*@/g, '//***@')

const docsOf = (state) => {
  const out = {}
  for (const name of ARRAYS) out[name] = new Map((state[name] || []).map((item) => [item.id, item]))
  out.runtime = new Map(Object.entries(state.runtime || {}))
  out.kv = new Map(SINGLETONS.map((key) => [key, { value: state[key] }]))
  return out
}

export const createMongoStorage = async ({ uri, dbName, timeoutMs = 8000, clientFactory = (u, o) => new MongoClient(u, o) }) => {
  const client = clientFactory(uri, { serverSelectionTimeoutMS: timeoutMs })
  try {
    await client.connect()
  } catch (error) {
    throw new Error(`Tidak dapat terhubung ke MongoDB (${redact(uri)}): ${redact(error.message)}`)
  }
  const db = client.db(dbName)
  const col = (name) => db.collection(name)

  await Promise.all([
    col('subscribers').createIndex({ chatId: 1 }, { unique: true }),
    col('codes').createIndex({ codeHash: 1 }, { unique: true }),
    col('accounts').createIndex({ platformId: 1, username: 1 }),
    col('history').createIndex({ accountId: 1, startAt: -1 }),
    col('logs').createIndex({ at: -1 })
  ])

  let snapshot = {}
  const seqs = new Map()
  let seqCounter = 0
  let chain = Promise.resolve()
  const info = { lastError: null, lastSavedAt: null }

  const nextSeq = () => {
    seqCounter = Math.max(seqCounter + 1, Date.now())
    return seqCounter
  }

  const takeSnapshot = (state) => {
    const taken = {}
    for (const [name, map] of Object.entries(docsOf(state))) taken[name] = new Map([...map].map(([id, value]) => [id, JSON.stringify(value)]))
    return taken
  }

  const load = async () => {
    const kv = await col('kv').find({}).toArray()
    if (!kv.some((d) => d._id === 'config')) return null
    const state = {}
    for (const d of kv) state[d._id] = d.value
    for (const name of ARRAYS) {
      const docs = await col(name).find({}).toArray()
      if (name === 'accounts') {
        docs.sort((a, b) => (b._seq ?? 0) - (a._seq ?? 0))
        docs.forEach((d) => {
          seqs.set(d._id, d._seq ?? 0)
          seqCounter = Math.max(seqCounter, d._seq ?? 0)
        })
      } else if (SORTS[name]) {
        docs.sort(SORTS[name])
      }
      state[name] = docs.map(({ _id, _seq, ...rest }) => rest)
    }
    const runtimeDocs = await col('runtime').find({}).toArray()
    state.runtime = Object.fromEntries(runtimeDocs.map(({ _id, ...rest }) => [_id, rest]))
    snapshot = takeSnapshot(state)
    return state
  }

  const saveNow = async (state) => {
    const current = docsOf(state)
    for (const [name, map] of Object.entries(current)) {
      const previous = snapshot[name] || new Map()
      const next = new Map()
      const ops = []
      const entries = name === 'accounts' ? [...map].reverse() : [...map]
      for (const [id, value] of entries) {
        const json = JSON.stringify(value)
        next.set(id, json)
        if (previous.get(id) === json) continue
        const doc = { _id: id, ...JSON.parse(json) }
        if (name === 'accounts') {
          if (!seqs.has(id)) seqs.set(id, nextSeq())
          doc._seq = seqs.get(id)
        }
        ops.push({ replaceOne: { filter: { _id: id }, replacement: doc, upsert: true } })
      }
      for (const id of previous.keys()) {
        if (!map.has(id)) {
          ops.push({ deleteOne: { filter: { _id: id } } })
          seqs.delete(id)
        }
      }
      if (ops.length) await col(name).bulkWrite(ops, { ordered: false })
      snapshot[name] = next
    }
    info.lastError = null
    info.lastSavedAt = new Date().toISOString()
  }

  const enqueue = (getState) => {
    chain = chain.then(() => saveNow(getState())).catch((error) => {
      info.lastError = redact(error.message)
      console.error(`Gagal menyimpan ke MongoDB: ${info.lastError}`)
    })
    return chain
  }

  return {
    load,
    enqueue,
    flush: () => chain,
    info: () => ({ ...info }),
    close: async () => {
      await chain
      await client.close()
    },
    database: db
  }
}
