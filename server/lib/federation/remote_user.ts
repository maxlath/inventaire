import { verifySignature } from '#controllers/activitypub/lib/security'
import { getUsersByIds } from '#controllers/user/lib/user'
import { isUserId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { requests_ } from '#lib/requests'
import { objectEntries } from '#lib/utils/base'
import { buildUrl } from '#lib/utils/url'
import type userAttributes from '#models/attributes/user'
import { publicHost } from '#server/config'
import type { Host } from '#types/common'
import type { AuthentifiedReq, MaybeSignedReq, RemoteUserAuthentifiedReq, UserAccountUri } from '#types/server'
import type { SpecialUser, User, UserId, UserOAuth, UserRole } from '#types/user'
import type { SetOptional } from 'type-fest'

export interface BareRemoteUser {
  remoteUserId: UserId
  host: Host
  acct: UserAccountUri
  roles: UserRole[]
  // Not used currently, but required to avoid type errors when typing user as (User | BareRemoteUser)
  oauth?: UserOAuth
}

type PublicUserAttributes = typeof userAttributes.public[number]

export type RemoteUser = Pick<User, PublicUserAttributes>
export interface RemoteUserWithAcct extends RemoteUser {
  acct: UserAccountUri
}

export interface LocalUserWithAcct extends User {
  acct: UserAccountUri
}

export type UserWithAcct = LocalUserWithAcct | RemoteUserWithAcct | BareRemoteUser

export const remoteUserHeader = 'x-remote-user'

export async function geRemoteUserFromSignedReqHeader (req: MaybeSignedReq) {
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
  } as BareRemoteUser
}

export function isRemoteUser (user: User | SpecialUser | BareRemoteUser): user is BareRemoteUser {
  return 'acct' in user
}

export function getLocalUserAcct (userId: UserId) {
  return `${userId}@${publicHost}` as UserAccountUri
}

export function getLocalUserIdFromAcct (userAcct: UserAccountUri): UserId | undefined {
  const [ userId, host ] = userAcct.split('@')
  if (host === publicHost) return userId
}

export function getUserAcct (user: User | SpecialUser | BareRemoteUser) {
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
    return users.map(user => setUserAcct(user, host))
  } else {
    return getRemoteUsersByIds(host, usersIds)
  }
}

async function getRemoteUsersByIds (host: Host, usersIds: UserId[]) {
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const path = buildUrl(`${protocol}://${host}/api/users`, { action: 'by-ids', ids: usersIds.join('|') })
  const { users } = await requests_.get(path, { timeout: 10000 })
  return Object.values(users).map((user: RemoteUser) => setUserAcct(user, host))
}

function setUserAcct (user: SetOptional<LocalUserWithAcct | RemoteUserWithAcct, 'acct'>, host: Host) {
  user.acct = `${user._id}@${host}`
  if (host === publicHost) return user as LocalUserWithAcct
  else return user as RemoteUserWithAcct
}

export async function getUserByAcct (userAcct: UserAccountUri) {
  const users = await getUsersByAccts([ userAcct ])
  return users[0]
}

export function parseReqLocalOrRemoteUser (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  if ('user' in req) return setUserAcct(req.user, publicHost) as LocalUserWithAcct
  else return req.remoteUser
}
