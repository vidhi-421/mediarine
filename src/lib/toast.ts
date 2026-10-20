import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  tone: 'success' | 'error' | 'info'
  message: string
}

let toasts: Toast[] = []
let n = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(tone: Toast['tone'], message: string) {
  const id = ++n
  toasts = [...toasts, { id, tone, message }].slice(-4)
  emit()
  setTimeout(() => dismissToast(id), tone === 'error' ? 8000 : 5000)
}

export const useToasts = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
