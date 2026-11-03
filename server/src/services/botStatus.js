const status = { configured: false, running: false, username: null, lastError: null }

export const botStatus = () => ({ ...status })

export const setBotStatus = (patch) => {
  Object.assign(status, patch)
}
