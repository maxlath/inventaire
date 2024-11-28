import { keyBy, set, without } from 'lodash-es'
import { getNetworkIds } from '#controllers/user/lib/relations_status'
import { dbFactory } from '#db/couchdb/base'
import { defaultAvatar } from '#lib/assets'
import { firstDoc } from '#lib/couch'
import { newError, notFoundError } from '#lib/error/error'
import searchUsersByDistanceFactory from '#lib/search_by_distance'
import searchUsersByPositionFactory from '#lib/search_by_position'
import { assertArray, assertString } from '#lib/utils/assert_types'
import { toLowerCase } from '#lib/utils/base'
import { setUserDocOauthTokens, addUserDocRole, removeUserDocRole, setUserDocStableUsername } from '#models/user'
import userValidations from '#models/validations/user'
import type { ImageHash } from '#types/image'
import type { OAuthProvider, OAuthProviderUserData } from '#types/oauth'
import type { DocWithUsernameInUserDb, Email, User, UserId, UserRole, Username } from '#types/user'
import { omitPrivateData, type UserExtraAttribute } from './authorized_user_data_pickers.js'
import { byEmail, byEmails, findOneByEmail } from './shared_user_handlers.js'

const db = await dbFactory('users')
const searchUsersByPosition = searchUsersByPositionFactory(db, 'users')
const searchUsersByDistance = searchUsersByDistanceFactory('users')

// TODO: include SpecialUser in possibly returned type
export const getUserById = db.get<User>
export const getUsersByIds = db.byIds<User>

export const findUserByEmail = (email: Email) => findOneByEmail<User>(db, email)
export const getUsersByEmail = (email: Email) => byEmail<User>(db, email)
export const getUsersByEmails = (emails: Email[]) => byEmails<User>(db, emails)

export function getUsersAuthorizedDataByEmails (emails: Email[], reqUserId: UserId) {
  assertArray(emails)
  // Keeping the email is required to map the users returned
  // with the initial input
  return getUsersAuthorizedData(getUsersByEmails(emails), reqUserId, 'email')
}

export function getUserByUsername (username: Username) {
  return db.getDocsByViewKey<DocWithUsernameInUserDb>('byUsername', username.toLowerCase())
}

export function getUsersByUsernames (usernames) {
  return db.getDocsByViewKeys<DocWithUsernameInUserDb>('byUsername', usernames.map(toLowerCase))
}

export function findUserByUsername (username: Username) {
  return getUserByUsername(username)
  .then(firstDoc)
  .then(user => {
    if (user) return user
    else throw notFoundError({ username })
  })
}

export function findUserByUsernameOrEmail (str: Username | Email) {
  if (userValidations.email(str)) {
    return findUserByEmail(str)
  } else {
    return findUserByUsername(str)
  }
}

export async function getUsersAuthorizedDataByIds (ids: UserId[], reqUserId: UserId, extraAttribute?: UserExtraAttribute) {
  assertArray(ids)
  if (ids.length === 0) return []
  return getUsersAuthorizedData(getUsersByIds(ids), reqUserId, extraAttribute)
}

export async function getUsersAuthorizedData (usersDocsPromise: Promise<DocWithUsernameInUserDb[]>, reqUserId: UserId, extraAttribute?: UserExtraAttribute) {
  const [ usersDocs, networkIds ] = await Promise.all([
    usersDocsPromise,
    getNetworkIds(reqUserId),
  ])

  return usersDocs.map(omitPrivateData(reqUserId, networkIds, extraAttribute))
}

export async function getUsersIndexedByIds (ids: UserId[], reqUserId: UserId, extraAttribute?: UserExtraAttribute) {
  const users = await getUsersAuthorizedDataByIds(ids, reqUserId, extraAttribute)
  return keyBy(users, '_id')
}

export async function getUsersIndexByUsernames (reqUserId: UserId, usernames: Username[]) {
  const users = await getUsersAuthorizedData(getUsersByUsernames(usernames), reqUserId)
  const usersByLowercasedUsername = {}
  const lowercasedUsernames = usernames.map(username => username.toLowerCase())
  for (const user of users) {
    const { username, stableUsername } = user
    if (lowercasedUsernames.includes(username.toLowerCase())) {
      usersByLowercasedUsername[username.toLowerCase()] = user
    } else if (lowercasedUsernames.includes(stableUsername.toLowerCase())) {
      usersByLowercasedUsername[stableUsername.toLowerCase()] = user
    }
  }
  return usersByLowercasedUsername
}

export async function incrementUndeliveredMailCounter (email: Email) {
  const doc = await findUserByEmail(email)
  const { _id } = doc
  return db.update(_id, doc => {
    if (doc.undeliveredEmail == null) doc.undeliveredEmail = 0
    doc.undeliveredEmail += 1
    return doc
  })
}

export const addUserRole = (userId: UserId, role: UserRole) => db.update(userId, addUserDocRole(role))

export const removeUserRole = (userId: UserId, role: UserRole) => db.update(userId, removeUserDocRole(role))

export function setUserOauthTokens (userId: UserId, provider: OAuthProvider, data: OAuthProviderUserData) {
  return db.update(userId, setUserDocOauthTokens(provider, data))
}

export async function setUserStableUsername (userData) {
  const { _id: userId, username, stableUsername } = userData
  if (stableUsername == null) {
    await db.update(userId, setUserDocStableUsername)
    userData.stableUsername = username
  }
  return userData
}

export async function getUsersNearby (userId: UserId, meterRange: number, strict?: boolean) {
  const { position } = await getUserById(userId)
  if (position == null) {
    throw newError('user has no position set', 400, { userId })
  }
  const usersIds = await findNearby(position, meterRange, null, strict)
  return without(usersIds, userId)
}

export const getUserByPosition = searchUsersByPosition

export async function imageIsUsed (imageHash: ImageHash) {
  assertString(imageHash)
  const { rows } = await db.view<User>('users', 'byPicture', { key: imageHash })
  return rows.length > 0
}

// View model serialization for emails and rss feeds templates
export function serializeUserData (user) {
  user.picture = user.picture || defaultAvatar
  return user
}

async function findNearby (latLng, meterRange, iterations = 0, strict = false) {
  const usersIds = await searchUsersByDistance(latLng, meterRange)
  // Try to get the 10 closest (11 minus the main user)
  // If strict, don't increase the range, just return what was found;
  // else double the range
  // But stop after 10 iterations to avoid creating an infinit loop
  // if there are no users geolocated
  if (usersIds.length > 11 || strict || iterations > 10) {
    return usersIds
  } else {
    iterations += 1
    return findNearby(latLng, meterRange * 2, iterations)
  }
}

export async function stopAllUserEmailNotifications (email) {
  const user = await findUserByEmail(email)
  return db.update(user._id, doc => {
    return set(doc, 'settings.notifications.global', false)
  })
}
