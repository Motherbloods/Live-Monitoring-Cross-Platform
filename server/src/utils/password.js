import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

const derive = (password, salt, n, r, p) =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key)))
  })

export const hashPassword = async (password) => {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P)
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`
}

export const verifyPassword = async (password, stored) => {
  const parts = String(stored || '').split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, salt, hash] = parts
  try {
    const expected = Buffer.from(hash, 'base64url')
    const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p))
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
