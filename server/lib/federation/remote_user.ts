import { difference, map } from 'lodash-es'
import { verifySignature } from '#controllers/activitypub/lib/security'
import { anonymizeUser, buildAnonymizedUser, getUsersByAnonymizedIds, type AnonymizedUser, type AnonymizeUserOptions, type DeanonymizedUser, type InstanceAgnosticContributor } from '#controllers/user/lib/anonymizable_user'
import { isUserId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { requests_ } from '#lib/requests'
import { objectEntries } from '#lib/utils/base'
import { logError } from '#lib/utils/logs'
import { buildUrl } from '#lib/utils/url'
import { publicHost } from '#server/config'
import type { Host } from '#types/common'
import type { AuthentifiedReq, MaybeSignedReq, RemoteUserAuthentifiedReq, UserAccountUri } from '#types/server'
import type { AnonymizableUserId, SpecialUser, User, UserOAuth, UserRole } from '#types/user'

export interface BareRemoteUser {
  anonymizableId: AnonymizableUserId
  host: Host
  acct: UserAccountUri
  roles: UserRole[]
  // Not used currently, but required to avoid type errors when typing user as (User | BareRemoteUser)
  oauth?: UserOAuth
}

export type RemoteUser = AnonymizedUser | DeanonymizedUser

export type RemoteUserWithAcct = RemoteUser & {
  acct: UserAccountUri
  roles: []
}

export interface LocalUserWithAcct extends User {
  acct: UserAccountUri
}

export type UserWithAcct = LocalUserWithAcct | RemoteUserWithAcct | BareRemoteUser | InstanceAgnosticContributor

export const remoteUserHeader = 'x-remote-user'

export async function geRemoteUserFromSignedReqHeader (req: MaybeSignedReq) {
  await verifySignature(req)
  const { host } = req.signed
  const anonymizableId = req.headers[remoteUserHeader]
  if (!anonymizableId) {
    throw newError(`could not authentify remote user: missing ${remoteUserHeader} header`, 400)
  }
  if (!isUserId(anonymizableId)) {
    throw newError(`could not authentify remote user: invalid ${remoteUserHeader} header`, 400, { anonymizableId })
  }
  return {
    anonymizableId,
    host,
    acct: buildUserAcct(anonymizableId, host),
    roles: [],
  } as BareRemoteUser
}

export function isRemoteUser (user: User | SpecialUser | BareRemoteUser): user is BareRemoteUser {
  return 'acct' in user
}

export function getLocalUserAcct (user: { anonymizableId: AnonymizableUserId }) {
  const { anonymizableId } = user
  return buildLocalUserAcct(anonymizableId)
}

export function buildUserAcct (anonymizableId: AnonymizableUserId, host: Host) {
  return `${anonymizableId}@${host}` as UserAccountUri
}

export function buildLocalUserAcct (anonymizableId: AnonymizableUserId) {
  return buildUserAcct(anonymizableId, publicHost)
}

export function getUserAcct (user: User | SpecialUser | BareRemoteUser) {
  if ('acct' in user) {
    return user.acct
  } else {
    return buildLocalUserAcct(user.anonymizableId)
  }
}

export function getMaybeRemoteReqUser (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  return 'remoteUser' in req ? req.remoteUser : req.user
}

export function getReqUserAcct (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  const user = getMaybeRemoteReqUser(req)
  return getUserAcct(user)
}

export async function getUsersByAccts (usersAccts: UserAccountUri[], options: AnonymizeUserOptions = {}) {
  const usersIdsByHosts = getUsersIdsByHostsFromUsersAccts(usersAccts)
  const hostsUsers = await Promise.all(objectEntries(usersIdsByHosts)
    .map(([ host, anonymizableUsersIds ]) => getHostUsersByIds(host, anonymizableUsersIds, options)))
  const foundUsers = hostsUsers.flat().map(setAsFound)
  const notFoundUsers = difference(usersAccts, map(foundUsers, 'acct'))
  const notFoundUsersPlaceholders = notFoundUsers.map(getNotFoundUserPlaceholder)
  return foundUsers.concat(notFoundUsersPlaceholders)
}

function setAsFound (user) {
  user.found = true
  return user
}

function getUsersIdsByHostsFromUsersAccts (usersAccts: UserAccountUri[]) {
  const usersIdsByHosts: Record<Host, AnonymizableUserId[]> = {}
  for (const userAcct of usersAccts) {
    const [ userId, host ] = userAcct.split('@')
    usersIdsByHosts[host] ??= []
    usersIdsByHosts[host].push(userId)
  }
  return usersIdsByHosts
}

async function getHostUsersByIds (host: Host, anonymizableUsersIds: AnonymizableUserId[], options: AnonymizeUserOptions) {
  if (host === publicHost) {
    const users = await getUsersByAnonymizedIds(anonymizableUsersIds)
    return users.map(user => setUserAcctAndRoles(anonymizeUser(user, options), host))
  } else {
    return getRemoteUsersByAnonymizableIds(host, anonymizableUsersIds)
  }
}

async function getRemoteUsersByAnonymizableIds (host: Host, anonymizableUsersIds: AnonymizableUserId[]) {
  try {
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const path = buildUrl(`${protocol}://${host}/api/users`, { action: 'by-anonymizable-ids', ids: anonymizableUsersIds.join('|') })
    // Use a short timeout as that should be a cheap operation
    // A lagging instance should not slow down the aggregated response
    const { users } = await requests_.get(path, { timeout: 10000 })
    return Object.values(users).map((user: RemoteUser) => setUserAcctAndRoles(user, host))
  } catch (err) {
    err.context ??= {}
    Object.assign(err.context, { host, anonymizableUsersIds })
    logError(err, 'failed to get remote users')
    return []
  }
}

function getNotFoundUserPlaceholder (acct: UserAccountUri) {
  const [ anonymizableId, host ] = acct.split('@')
  const userPlaceholder = buildAnonymizedUser({ anonymizableId })
  return { ...setUserAcctAndRoles(userPlaceholder, host), found: false }
}

function setUserAcctAndRoles <T extends Pick<User, 'anonymizableId'>> (user: T, host: Host) {
  const acct = buildUserAcct(user.anonymizableId, host)
  const roles = ('roles' in user ? user.roles : []) as UserRole[]
  return { ...user, acct, roles }
}

export async function getUserByAcct (userAcct: UserAccountUri) {
  const users = await getUsersByAccts([ userAcct ])
  const user = users[0]
  if (!user) throw newError('user not found', 500, { userAcct })
  return user as InstanceAgnosticContributor
}

export function parseReqLocalOrRemoteUser (req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  if ('user' in req) return setUserAcctAndRoles(req.user, publicHost) as LocalUserWithAcct
  else return req.remoteUser
}
