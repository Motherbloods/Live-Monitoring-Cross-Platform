import { persistConfig } from '../services/mockConfigurationService.js'

export const settingsApi = {
  saveConfig: (config) => persistConfig(config)
}
