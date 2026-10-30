import { http } from './client.js'

export const serverApi = {
  snapshot: async () => {
    const [accounts, platforms, config, history, recordings, logs] = await Promise.all([
      http('GET', '/accounts'),
      http('GET', '/platforms'),
      http('GET', '/config'),
      http('GET', '/history'),
      http('GET', '/recordings'),
      http('GET', '/logs')
    ])
    return { accounts: accounts.accounts, platforms: platforms.platforms, config: config.config, savedAt: config.savedAt, history: history.history, recordings: recordings.recordings, logs: logs.logs }
  },
  createAccount: (body) => http('POST', '/accounts', body),
  updateAccount: (id, body) => http('PATCH', `/accounts/${id}`, body),
  deleteAccount: (id) => http('DELETE', `/accounts/${id}`),
  setMonitoring: (id, enabled) => http('PATCH', `/accounts/${id}/monitoring`, { enabled }),
  checkAccount: (id) => http('POST', `/accounts/${id}/check`),
  patchConfig: (body) => http('PATCH', '/config', body),
  patchPlatform: (id, body) => http('PATCH', `/platforms/${id}/config`, body),
  checkPlatform: (id) => http('POST', `/platforms/${id}/check`),
  restartPlatform: (id) => http('POST', `/platforms/${id}/restart`),
  checkAll: () => http('POST', '/monitoring/check-all'),
  startMonitoring: () => http('POST', '/monitoring/start'),
  stopMonitoring: () => http('POST', '/monitoring/stop')
}
