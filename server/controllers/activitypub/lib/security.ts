import { createSign, createVerify } from 'node:crypto'
import { isNonEmptyPlainObject } from '#lib/boolean_validations'
import { cache_ } from '#lib/cache'
import { getSha256Base64Digest } from '#lib/crypto'
import { newError } from '#lib/error/error'
import { requests_, sanitizeUrl } from '#lib/requests'
import { expired, oneMonth } from '#lib/time'
import { assertObject } from '#lib/utils/assert_types'
import { logError, warn } from '#lib/utils/logs'
import config from '#server/config'
import type { ActorKeyId } from '#types/activity'
import type { AbsoluteUrl, HttpHeaders, RelativeUrl } from '#types/common'
import type { LowerCasedHttpMethod } from '#types/controllers'
import type { MaybeSignedReq, SignedReq } from '#types/server'

interface Signature {
  keyId: string
  signature: string
  headers: string
}

const { sanitizeUrls } = config.activitypub

interface SignParams {
  keyId: ActorKeyId
  privateKey: string
  method: LowerCasedHttpMethod
  pathname: RelativeUrl
  reqHeaders: HttpHeaders
}
export function sign (params: SignParams) {
  const { keyId, privateKey, method, pathname, reqHeaders } = params
  const signedHeadersNames = Object.keys(reqHeaders).join(' ')
  const signer = createSign('rsa-sha256')
  const stringToSign = buildSignatureString({
    reqHeaders,
    signedHeadersNames,
    method,
    pathname,
  })
  signer.update(stringToSign)
  signer.end()
  const signature = signer.sign(privateKey)
  const signatureB64 = signature.toString('base64')
  // headers must respect signature string keys order
  // ie. (request-target) host date
  // see Section 2.3 of https://tools.ietf.org/html/draft-cavage-http-signatures-08
  return `keyId="${keyId}",headers="(request-target) ${signedHeadersNames}",signature="${signatureB64}"`
}

export async function verifySignature (req: MaybeSignedReq) {
  const { headers: reqHeaders } = req
  const { date } = reqHeaders
  let { signature } = reqHeaders
  // 30 seconds time window for that signature to be considered valid
  if (thirtySecondsTimeWindow(date)) throw newError('outdated request', 400, reqHeaders)
  if (signature === undefined) throw newError('no signature header', 400, reqHeaders)
  if (signature instanceof Array) signature = signature[0]
  const parsedSignature = parseSignature(signature)
  const { keyId: actorKeyUrl } = parsedSignature
  try {
    await attemptToVerifySignature(req, parsedSignature)
  } catch (err) {
    logError(err, 'Signature verification failed: retrying with a refreshed cache')
    await attemptToVerifySignature(req, parsedSignature, true)
  }
  const { host } = new URL(actorKeyUrl)
  req.signed = { host }
  return req as SignedReq
}

async function attemptToVerifySignature (req: MaybeSignedReq, signature: Signature, refresh = false) {
  // "headers" below specify the list of HTTP headers included when generating the signature for the message
  const { keyId: actorKeyUrl, signature: signatureString, headers: signedHeadersNames } = signature
  const { method, path: pathname, headers: reqHeaders } = req
  let publicKeyPem
  try {
    publicKeyPem = await getActorPublicKeyPem(actorKeyUrl, refresh)
  } catch (err) {
    warn({ method, pathname, body: req.body }, 'could not fetch public key')
    throw err
  }
  const verifier = createVerify('rsa-sha256')
  const signedString = buildSignatureString({
    reqHeaders: reqHeaders as HttpHeaders,
    signedHeadersNames,
    method: method.toLowerCase() as LowerCasedHttpMethod,
    pathname: pathname as RelativeUrl,
  })
  verifier.update(signedString)
  if (!verifier.verify(publicKeyPem, signatureString, 'base64')) {
    throw newError('signature verification failed', 400, { actorKeyUrl, publicKeyPem })
  }
}

interface SignRequestParams {
  url: AbsoluteUrl
  method: LowerCasedHttpMethod
  keyId: ActorKeyId
  privateKey: string
  body: unknown
  headers?: HttpHeaders
}
export function signRequest ({ url, method, keyId, privateKey, body, headers = {} }: SignRequestParams) {
  const date = new Date().toUTCString()
  const { host, pathname } = new URL(url)
  // The minimum recommended data to sign is the (request-target), host, and date.
  // Source: https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-10#appendix-C.2
  // The digest is additionnal required by Mastodon
  // Source: https://github.com/mastodon/mastodon/blob/main/app/controllers/concerns/signature_verification.rb
  const reqHeaders: HttpHeaders = { host, date, ...headers }
  if (body) {
    assertObject(body)
    reqHeaders.digest = `SHA-256=${getSha256Base64Digest(JSON.stringify(body))}`
  }
  reqHeaders.signature = sign({
    keyId,
    privateKey,
    reqHeaders,
    method,
    pathname: pathname as RelativeUrl,
  })
  return reqHeaders
}

// 'date' must be a UTC string
interface BuildSignatureStringParams {
  reqHeaders: HttpHeaders
  signedHeadersNames: string
  pathname: RelativeUrl
  method: LowerCasedHttpMethod
}
function buildSignatureString (params: BuildSignatureStringParams) {
  const { reqHeaders, signedHeadersNames, pathname } = params
  let { method } = params
  // 'method' must be lowercased
  method = method.toLowerCase() as LowerCasedHttpMethod
  let signatureString = `(request-target): ${method} ${pathname}`
  const orderedSignedHeadersKeys = signedHeadersNames
    .replace('(request-target)', '')
    .trim()
    .split(' ')
  // Keys order matters, so we can't just loop over reqHeaders keys
  for (const key of orderedSignedHeadersKeys) {
    if (reqHeaders[key] != null) {
      signatureString += `\n${key}: ${reqHeaders[key]}`
    } else {
      throw newError('missing header', 400, { key, params })
    }
  }
  return signatureString
}

async function getActorPublicKeyPem (actorUrl: string, refresh = false) {
  const cacheKey = `actor-public-key-pem:${encodeURIComponent(actorUrl)}`
  return cache_.get({
    key: cacheKey,
    fn: () => fetchActorPublicKeyPem(actorUrl),
    // PEMs are assumed to be immutable, which is the case for Inventaire instances
    // as a sha1 hash of the PEM is part of the actor url
    ttl: oneMonth,
    refresh,
  })
}

async function fetchActorPublicKeyPem (actorUrl: string) {
  if (sanitizeUrls) actorUrl = await sanitizeUrl(actorUrl)
  const actor = await requests_.get(actorUrl as AbsoluteUrl)
  assertObject(actor)
  if (!('publicKey' in actor)) {
    throw newError('no publicKey found', 400, { actor })
  }
  const { publicKey } = actor
  if (!publicKey) {
    throw newError('no publicKey found', 400, actor)
  }
  if (!isNonEmptyPlainObject(publicKey) || typeof publicKey.publicKeyPem !== 'string') {
    throw newError('invalid publicKey found', 400, { publicKey })
  }
  const { publicKeyPem } = publicKey
  if (!publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----\n')) {
    throw newError('invalid publicKeyPem found', 400, { publicKey })
  }
  // TODO: handle timeout
  return publicKeyPem
}

function parseSignature (signature: string) {
  const signatureParts = signature.split('",')
  const signatureObj = {}
  for (const part of signatureParts) {
    // trailing =" for signature key
    let [ key, value ] = part.split('="')
    if (key === 'signature') value += '='
    signatureObj[key] = removeTrailingQuote(value)
  }
  return signatureObj as Signature
}

const removeTrailingQuote = line => line.replace(/"$/, '')

const thirtySecondsTimeWindow = date => expired(Date.parse(date), 30000)
