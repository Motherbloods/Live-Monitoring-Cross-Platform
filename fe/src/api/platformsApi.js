import { saveConfig, startService } from '../services/mockPlatformsService.js'

export const platformsApi = {
  saveConfig: (platformId, patch) => saveConfig(patch),
  startService: (platformId) => startService(platformId)
}
