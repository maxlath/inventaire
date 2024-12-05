// Using a single key pair shared between all actors managed by this server.
// Using a key pair per user would make sense if the server was storing encrypted data
// but as we are storing data in plain text, using different key pairs doesn't seem to bring any value
// See https://github.com/w3c/activitypub/issues/225
// As for key caching, "refresh on fail" seems to be the most used strategy,
// so simply creating a new shared key pair every time the server restarts seems acceptable,
// cached keys will get refreshed at their next attempt
// See https://socialhub.activitypub.rocks/t/caching-public-keys/688

import { generateRsaKeyPair, sha1 } from '#lib/crypto'

let sharedKeyPairPromise

async function _getSharedKeyPair () {
  const { privateKey, publicKey } = await generateRsaKeyPair()
  const publicKeyHash = sha1(publicKey).slice(0, 10)
  return { privateKey, publicKey, publicKeyHash }
}

export async function getSharedKeyPair () {
  sharedKeyPairPromise ??= _getSharedKeyPair()
  return sharedKeyPairPromise
}
