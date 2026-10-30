import { delay } from '../api/client.js'

export const saveConfig = async (patch) => {
  await delay(500)
  return patch
}

export const startService = async () => {
  await delay(1100)
  return { status: 'online', lastError: null, retryCount: 0 }
}
