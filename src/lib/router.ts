import { useSyncExternalStore } from 'react'

const sub = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const get = () => window.location.hash.replace(/^#/, '') || '/'

export const useRoute = () => useSyncExternalStore(sub, get).split('?')[0]
export const useQuery = () => new URLSearchParams(useSyncExternalStore(sub, get).split('?')[1] ?? '')
export const navigate = (to: string) => {
  window.location.hash = to
}
