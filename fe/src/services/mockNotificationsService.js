import { delay } from '../api/client.js'

export const sendTest = async () => {
  await delay(700)
  return { ok: Math.random() > 0.1 }
}
