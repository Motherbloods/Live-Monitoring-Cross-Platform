import { delay } from '../api/client.js'
import { PLATFORMS } from '../config/defaults.js'

const hosts = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.hostHint]))

export const createAccount = async (form, username) => {
  await delay(500)
  return {
    id: `acc_${Date.now()}`,
    platformId: form.platformId,
    username,
    displayName: form.displayName.trim() || username,
    profileUrl: form.profileUrl.trim() || `https://${hosts[form.platformId]}/${username}`,
    monitoringEnabled: form.monitoringEnabled,
    useCustomCheckInterval: form.useCustomCheckInterval,
    customCheckIntervalSeconds: form.useCustomCheckInterval ? Number(form.customCheckIntervalSeconds) : null,
    autoRecording: form.autoRecording,
    notifyEnabled: form.notifyEnabled,
    notifyOnStart: form.notifyOnStart,
    notifyOnEnd: form.notifyOnEnd,
    notes: form.notes.trim()
  }
}

export const patchAccount = async (patch) => {
  await delay(450)
  return patch
}

export const removeAccount = async () => {
  await delay(450)
  return true
}
