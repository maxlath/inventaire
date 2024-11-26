import crypto from 'node:crypto'
import { isNonEmptyPlainObject } from '#lib/boolean_validations'
import { getSha256Base64Digest } from '#lib/crypto'
import { newError } from '#lib/error/error'
import { requests_, sanitizeUrl } from '#lib/requests'
import { expired } from '#lib/time'
import { assertObject } from '#lib/utils/assert_types'
import { warn } from '#lib/utils/logs'
import config from '#server/config'
import type { MaybeSignedReq, SignedReq } from '#server/types/server'
import type { AbsoluteUrl, HttpHeaders } from '#types/common'

const { sanitizeUrls } = config.activitypub

export function sign (params) {
  const { keyId, privateKey, method, pathname, reqHeaders } = params
  const signedHeadersNames = Object.keys(reqHeaders).join(' ')
  const signer = crypto.createSign('rsa-sha256')
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
  const { method, path: pathname, headers: reqHeaders } = req
  const { date, signature } = reqHeaders
  // 30 seconds time window for that signature to be considered valid
  if (thirtySecondsTimeWindow(date)) throw newError('outdated request', 400, reqHeaders)
  if (signature === undefined) throw newError('no signature header', 400, reqHeaders)
  // "headers" below specify the list of HTTP headers included when generating the signature for the message
  const { keyId: actorUrl, signature: signatureString, headers: signedHeadersNames } = parseSignature(signature)
  let publicKey
  try {
    publicKey = await fetchActorPublicKey(actorUrl)
  } catch (err) {
    warn({ method, pathname, body: req.body }, 'could not fetch public key')
    throw err
  }
  const verifier = crypto.createVerify('rsa-sha256')
  const signedString = buildSignatureString({
    reqHeaders,
    signedHeadersNames,
    method,
    pathname,
  })
  verifier.update(signedString)
  if (verifier.verify(publicKey.publicKeyPem, signatureString, 'base64')) {
    const { host } = new URL(actorUrl)
    req.signed = { host }
    return req as SignedReq
  } else {
    throw newError('signature verification failed', 400, { publicKey })
  }
  // TODO: verify date
}

export function signRequest ({ url, method, keyId, privateKey, body, headers = {} }) {
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
  const signedHeadersNames = Object.keys(reqHeaders).join(' ')
  reqHeaders.signature = sign({
    keyId,
    privateKey,
    signedHeadersNames,
    reqHeaders,
    method,
    pathname,
  })
  return reqHeaders
}

// 'date' must be a UTC string
// 'method' must be lowercased
function buildSignatureString (params) {
  const { reqHeaders, signedHeadersNames, pathname } = params
  let { method } = params
  method = method.toLowerCase()
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

async function fetchActorPublicKey (actorUrl: string) {
  if (sanitizeUrls) actorUrl = await sanitizeUrl(actorUrl)
  const actor = await requests_.get(actorUrl as AbsoluteUrl)
  assertObject(actor)
  if (!('publicKey' in actor)) {
    throw newError('no publicKey found', 400, { actor })
  }
  const { publicKey } = actor
  if (!isNonEmptyPlainObject(publicKey) || typeof publicKey.publicKeyPem !== 'string') {
    throw newError('invalid publicKey found', 400, { publicKey })
  }
  const { publicKeyPem } = publicKey
  if (!publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----\n')) {
    throw newError('invalid publicKeyPem found', 400, { publicKey })
  }
  // TODO: handle timeout
  return actor.publicKey
}

interface Signature {
  keyId: string
  signature: string
  headers: string
}

function parseSignature (signature) {
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
