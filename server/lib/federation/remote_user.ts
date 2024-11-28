import { verifySignature } from '#controllers/activitypub/lib/security'
import { isUserId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { publicHost } from '#server/config'
import type { Host } from '#types/common'
import type { AuthentifiedReq, MaybeSignedReq, RemoteUserAuthentifiedReq, UserAccountUri } from '#types/server'
import type { SpecialUser, User, UserId, UserOAuth, UserRole } from '#types/user'

export interface RemoteUser {
  remoteUserId: UserId
  host: Host
  acct: UserAccountUri
  roles: UserRole[]
  // Not used currently, but required to avoid type errors when typing user as (User | RemoteUser)
  oauth?: UserOAuth
}

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
    roles: [],
  } as RemoteUser
}

export function isRemoteUser (user: User | SpecialUser | RemoteUser): user is RemoteUser {
  return 'acct' in user
}

export function getLocalUserAcct (userId: UserId) {
  return `${userId}@${publicHost}` as UserAccountUri
}

export function getUserAcct (user: User | SpecialUser | RemoteUser) {
  if ('acct' in user) {
    return user.acct
  } else {
    return getLocalUserAcct(user._id)
  }
}

export function getMaybeRemoteReqUser (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  return 'remoteUser' in req ? req.remoteUser : req.user
}

export function getReqUserAcct (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  const user = getMaybeRemoteReqUser(req)
  return getUserAcct(user)
}
