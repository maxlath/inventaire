import { verifySignature } from '#controllers/activitypub/lib/security'
import { getUsersByIds } from '#controllers/user/lib/user'
import { isUserId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { requests_ } from '#lib/requests'
import { objectEntries } from '#lib/utils/base'
import { buildUrl } from '#lib/utils/url'
import { publicHost } from '#server/config'
import type { Host } from '#types/common'
import type { AuthentifiedReq, MaybeSignedReq, RemoteUserAuthentifiedReq, UserAccountUri } from '#types/server'
import type { SpecialUser, User, UserId, UserOAuth, UserRole } from '#types/user'
import type { SetOptional } from 'type-fest'

export interface RemoteUser {
  remoteUserId: UserId
  host: Host
  acct: UserAccountUri
  roles: UserRole[]
  // Not used currently, but required to avoid type errors when typing user as (User | RemoteUser)
  oauth?: UserOAuth
}

export interface UserWithAcct extends User {
  acct: UserAccountUri
}

export const remoteUserHeader = 'x-remote-user'

export async function getReqRemoteUser (req: MaybeSignedReq) {
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

export function getLocalUserIdFromAcct (userAcct: UserAccountUri): UserId | undefined {
  const [ userId, host ] = userAcct.split('@')
  if (host === publicHost) return userId
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

export async function getUsersByAccts (usersAccts: UserAccountUri[]) {
  const usersIdsByHosts = getUsersIdsByHostsFromUsersAccts(usersAccts)
  const hostsUsers = await Promise.all(objectEntries(usersIdsByHosts).map(getHostUsersByIds))
  return hostsUsers.flat()
}

function getUsersIdsByHostsFromUsersAccts (usersAccts: UserAccountUri[]) {
  const usersIdsByHosts: Record<Host, UserId[]> = {}
  for (const userAcct of usersAccts) {
    const [ userId, host ] = userAcct.split('@')
    usersIdsByHosts[host] ??= []
    usersIdsByHosts[host].push(userId)
  }
  return usersIdsByHosts
}

async function getHostUsersByIds ([ host, usersIds ]: [ Host, UserId[] ]) {
  let users: User[]
  if (host === publicHost) {
    users = await getUsersByIds(usersIds)
  } else {
    users = await getRemoteUsersByIds(host, usersIds)
  }
  return users.map(user => setUserAcct(user, host))
}

async function getRemoteUsersByIds (host: Host, usersIds: UserId[]) {
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const path = buildUrl(`${protocol}://${host}/api/users`, { action: 'by-ids', ids: usersIds.join('|') })
  const { users } = await requests_.get(path, { timeout: 10000 })
  return users
}

function setUserAcct (user: SetOptional<UserWithAcct, 'acct'>, host: Host) {
  user.acct = `${user._id}@${host}`
  return user as UserWithAcct
}
