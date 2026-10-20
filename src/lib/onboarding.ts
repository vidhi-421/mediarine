import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const key = (user: string) => `medarina.onboarded.${user || 'guest'}`
let replay = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Re-opens the onboarding tour from Help or Settings. */
export function replayOnboarding() {
  replay = true
  emit()
}

export function useOnboarding(user: string) {
  const replaying = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => replay)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(key(user)) === '1' } catch { return true } })
  useEffect(() => { try { setSeen(localStorage.getItem(key(user)) === '1') } catch { /* ignore */ } }, [user])
  const finish = useCallback(() => {
    try { localStorage.setItem(key(user), '1') } catch { /* storage unavailable */ }
    setSeen(true)
    replay = false
    emit()
  }, [user])
  return { open: !seen || replaying, finish }
}

