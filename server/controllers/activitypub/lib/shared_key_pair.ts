// Using a single key pair shared between all actors managed by this server.
// Using a key pair per user would make sense if the server was storing encrypted data
// but as we are storing data in plain text, using different key pairs doesn't seem to bring any value
// See https://github.com/w3c/activitypub/issues/225
// Actors using this shared key pair includes the instance actor,
// which uses it to sign federated entities requests

import { readFile, writeFile } from 'node:fs/promises'
import { absolutePath } from '#lib/absolute_path'
import { generateRsaKeyPair, sha1 } from '#lib/crypto'
import { fileOwnerOnlyReadWriteMode } from '#lib/fs'
import { expired, oneMonth } from '#lib/time'
import { info } from '#lib/utils/logs'

const keysFilePath = absolutePath('root', 'keys/shared_key_pair.json')
const keysTtl = 6 * oneMonth

let sharedKeyPairPromise

async function generateSharedKeyPair () {
  const { privateKey, publicKey } = await generateRsaKeyPair()
  const publicKeyHash = sha1(publicKey).slice(0, 10)
  const created = new Date().toISOString()
  return { created, publicKeyHash, publicKey, privateKey }
}

async function generateAndSaveSharedKeyPair () {
  const newKeyPair = await generateSharedKeyPair()
  await writeFile(keysFilePath, JSON.stringify(newKeyPair), { mode: fileOwnerOnlyReadWriteMode })
  return newKeyPair
}

async function _getSharedKeyPair () {
  try {
    const file = await readFile(keysFilePath)
    const oldKeyPair = JSON.parse(file.toString())
    if (expired(oldKeyPair.created, keysTtl)) {
      info(`Shared key pair ${oldKeyPair.publicKeyHash} expired: regenerating`)
      return generateAndSaveSharedKeyPair()
    } else {
      info(`Reusing shared key pair ${oldKeyPair.publicKeyHash} (created: ${oldKeyPair.created})`)
      return oldKeyPair
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      info('Shared key pair not found: generating')
      return generateAndSaveSharedKeyPair()
    } else {
      throw err
    }
  }
}

export async function getSharedKeyPair () {
  sharedKeyPairPromise ??= _getSharedKeyPair()
  return sharedKeyPairPromise
}
