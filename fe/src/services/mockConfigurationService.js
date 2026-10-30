import { delay } from '../api/client.js'
import { saveConfig } from '../config/configurationManager.js'

export const persistConfig = async (config) => {
  await delay(550)
  return saveConfig(config)
}
