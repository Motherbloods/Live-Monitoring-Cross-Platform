import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '../api/serverApi.js'
import { useAppStore } from '../store/appStore.js'

export default function useSubscription() {
  const pushToast = useAppStore((s) => s.pushToast)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await serverApi.subscriptionOverview())
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  const run = useCallback(
    async (fn, okMessage) => {
      try {
        const result = await fn()
        await load()
        if (okMessage) pushToast(okMessage, 'ok')
        return result ?? true
      } catch (e) {
        pushToast(e.message, 'warn')
        return false
      }
    },
    [load, pushToast]
  )

  return { data, loading, error, reload: load, run }
}
