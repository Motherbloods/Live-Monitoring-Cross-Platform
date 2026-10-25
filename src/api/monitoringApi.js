import { checkAccounts, restartPlatform } from '../services/mockMonitoringService.js'

export const monitoringApi = {
  checkAccounts: (accounts, runtime) => checkAccounts(accounts, runtime),
  restartPlatform: (platformId) => restartPlatform(platformId)
}
