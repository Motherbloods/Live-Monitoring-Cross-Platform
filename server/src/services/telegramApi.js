export const createBotApi = (getToken) => async (method, params = {}, { timeoutMs = 15000, signal } = {}) => {
  const token = getToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  signal?.addEventListener('abort', () => controller.abort())
  const clean = (message) => String(message).split(token).join('***').replace(/bot\d+:[\w-]+/g, 'bot***')
  let response
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal
    })
  } catch (error) {
    const err = new Error(error.name === 'AbortError' ? 'Telegram tidak merespons (timeout).' : 'Tidak dapat menghubungi Telegram.')
    err.network = true
    throw err
  } finally {
    clearTimeout(timer)
  }
  const data = await response.json().catch(() => null)
  if (!data?.ok) {
    const err = new Error(clean(data?.description || `Telegram menjawab HTTP ${response.status}`))
    err.code = data?.error_code ?? response.status
    err.retryAfter = data?.parameters?.retry_after
    throw err
  }
  return data.result
}
