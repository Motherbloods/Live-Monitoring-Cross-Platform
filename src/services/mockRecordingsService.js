import { delay } from '../api/client.js'

export const changeStatus = async (id, status) => {
  await delay(450)
  return { id, status }
}
