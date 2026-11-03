const status = { configured: false, running: false, username: null, lastError: null }
const stats = { pending: 0, sent: 0, failed: 0 }

export const botStatus = () => ({ ...status, queue: { ...stats } })

export const setBotStatus = (patch) => {
  Object.assign(status, patch)
}

export const bumpQueue = (key, delta = 1) => {
  stats[key] += delta
}
