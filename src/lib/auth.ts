import { useSyncExternalStore } from 'react'

export interface Session {
  name: string
  email: string
  guest?: boolean
}
interface Account {
  name: string
  email: string
  organization?: string
  salt: string
  hash: string
}

const ACCOUNTS = 'medarina.accounts.v1'
const SESSION = 'medarina.session.v1'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const readAccounts = (): Account[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) ?? '[]')
  } catch {
    return []
  }
}
const writeAccounts = (a: Account[]) => localStorage.setItem(ACCOUNTS, JSON.stringify(a))

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, '0')).join('')
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt: new TextEncoder().encode(salt) }, key, 256)
  return hex(bits)
}

let cached: Session | null | undefined
function readSession(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(SESSION) ?? sessionStorage.getItem(SESSION)
    cached = raw ? JSON.parse(raw) : null
  } catch {
    cached = null
  }
  return cached ?? null
}
function setSession(s: Session | null, remember = true) {
  cached = s
  localStorage.removeItem(SESSION)
  sessionStorage.removeItem(SESSION)
  if (s) (remember ? localStorage : sessionStorage).setItem(SESSION, JSON.stringify(s))
  emit()
}

export const useSession = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    readSession,
  )

const norm = (e: string) => e.trim().toLowerCase()
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function signUp(input: { name: string; email: string; password: string; organization?: string }) {
  if (readAccounts().some((a) => a.email === norm(input.email))) throw new Error('An account with this email already exists on this device.')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await derive(input.password, salt)
  writeAccounts([...readAccounts(), { name: input.name.trim(), email: norm(input.email), organization: input.organization?.trim(), salt, hash }])
  setSession({ name: input.name.trim(), email: norm(input.email) })
}

export async function signIn(email: string, password: string, remember: boolean) {
  const acc = readAccounts().find((a) => a.email === norm(email))
  const ok = acc && (await derive(password, acc.salt)) === acc.hash
  if (!acc || !ok) throw new Error('The email or password is incorrect.')
  await delay(200)
  setSession({ name: acc.name, email: acc.email }, remember)
}

export const accountExists = (email: string) => readAccounts().some((a) => a.email === norm(email))

export async function resetPassword(email: string, password: string) {
  const list = readAccounts()
  const acc = list.find((a) => a.email === norm(email))
  if (!acc) throw new Error('No account with this email exists on this device.')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  acc.salt = salt
  acc.hash = await derive(password, salt)
  writeAccounts(list)
}

export const continueAsGuest = () => setSession({ name: 'Sample workspace', email: '', guest: true }, false)
export const signOut = () => setSession(null)
