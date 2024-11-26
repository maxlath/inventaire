import { verifySignature } from '#controllers/activitypub/lib/security'
import { isUserId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import type { MaybeSignedReq } from '#server/types/server'

export const remoteUserHeader = 'x-remote-user'

export async function getRemoteUser (req: MaybeSignedReq) {
  await verifySignature(req)
  const { host } = req.signed
  const remoteUserId = req.headers[remoteUserHeader]
  if (!remoteUserId) {
    throw newError(`could not authentify remote user: missing ${remoteUserHeader} header`, 400)
  }
  if (!isUserId(remoteUserId)) {
    throw newError(`could not authentify remote user: invalid ${remoteUserHeader} header`, 400, { remoteUserId })
  }
  return {
    remoteUserId,
    host,
    acct: `${remoteUserId}@${host}`,
  }
}
