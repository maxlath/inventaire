import { softwareName } from '#lib/package'
import config from '#server/config'

export const sessionCookieName = `${softwareName}:${config.env}:session`
export const sessionSignatureCookieName = `${sessionCookieName}.sig`
const sessionCookiePattern = new RegExp(`${sessionCookieName}=([^;]+);`)
const sessionSignatureCookiePattern = new RegExp(`${sessionCookieName}\\.sig=([^;]+);`)

export function parseSessionCookies (cookieStr: string) {
  const sessionCookieMatch = cookieStr.match(sessionCookiePattern)
  const sessionSignatureCookieMatch = cookieStr.match(sessionSignatureCookiePattern)
  const sessionCookie = sessionCookieMatch?.[1]
  const signatureCookie = sessionSignatureCookieMatch?.[1]
  return [ sessionCookie, signatureCookie ]
}

export function buildSessionCookies (sessionCookie, signatureCookie) {
  return `${sessionCookieName}=${sessionCookie}; ${sessionSignatureCookieName}=${signatureCookie};`
}

export const buildBase64EncodedJson = obj => Buffer.from(JSON.stringify(obj)).toString('base64')

export function parseBase64EncodedJson (base64Str: string) {
  return JSON.parse(Buffer.from(base64Str, 'base64').toString())
}
