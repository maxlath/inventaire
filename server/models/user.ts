import { get, omit, pick, without } from 'lodash-es'
import { getRandomUuid, hashPassword } from '#lib/crypto'
import { newError } from '#lib/error/error'
import { newInvalidError } from '#lib/error/pre_filled'
import { truncateLatLng } from '#lib/geo'
import { assertStrings, assertObject, assertString } from '#lib/utils/assert_types'
import { normalizeString, arrayIncludes } from '#lib/utils/base'
import { log } from '#lib/utils/logs'
import { getRandomString } from '#lib/utils/random_string'
import type { StringifiedHashedSecretData } from '#types/common'
import type { OAuthProvider, OAuthProviderUserData } from '#types/oauth'
import type { User, Email, DeletedUser, UserRole, DocWithUsernameInUserDb, InvitedUser, Username } from '#types/user'
import userAttributes from './attributes/user.js'
import userValidations from './validations/user.js'

const generateReadToken = getRandomString.bind(null, 32)

export async function createUserDoc (username: string, email: Email, language: string, password: string) {
  log([ username, email, language, `password:${(password != null)}` ], 'creating user')
  assertStrings([ username, email ])
  if (language != null) { assertString(language) }

  username = userFormatters.username(username)

  userValidations.pass('username', username)
  userValidations.pass('email', email)

  // it's ok to have an undefined language
  if (language && !userValidations.language(language)) {
    throw newInvalidError('language', language)
  }

  const user: Partial<User> = {
    username,
    email,
    type: 'user',
    created: Date.now(),
    language,
    settings: {},
    // A secondary user id, that will expose different user info depending on the value of settings.contributions.anonymize
    // - if true: no user info is sent, the user account uri `${anonymizableId}@${host}` is used as the account pseudo
    // - if false: basic user info (username, picture, created, etc) become publicly accessible from that user account uri
    anonymizableId: getRandomUuid(),
    // A token that, when combined with the right user id,
    // gives access to all the resources the user can read
    // Use case:
    // - private RSS feeds
    // This token can be passed in a URL with the following considerations in mind
    // http://stackoverflow.com/a/643480/3324977
    readToken: generateReadToken(),
    // Snapshot data by visibility
    snapshot: {
      private: { 'items:count': 0 },
      network: { 'items:count': 0 },
      public: { 'items:count': 0 },
    },
  }

  user.validEmail = false
  if (!userValidations.password(password)) {
    // Do NOT pass the password as context, as it would be logged
    // and returned in the response
    throw newError('invalid password', 400)
  }
  user.password = password

  await hashUserPassword(user)

  return user
}

async function hashUserPassword (user: Partial<User>) {
  const { password } = user
  if (password != null) {
    const hash = await hashPassword(password)
    user.password = hash
  }
}

export async function upgradeInvitedUser (invitedDoc: InvitedUser, username: Username, language: string, password: string) {
  const { email } = invitedDoc
  const userDoc = await createUserDoc(username, email, language, password)
  // Will override type but keep inviters and inviting groups
  return Object.assign(invitedDoc, userDoc)
}

export function softDeleteUser (userDoc: User) {
  const userSouvenir: DeletedUser = {
    ...pick(userDoc, userAttributes.critical),
    type: 'deleted',
    deleted: Date.now(),
  }
  return userSouvenir
}

export function updateUserDocEmail (doc, email) {
  if (email !== doc.email) {
    doc.email = email
    doc.validEmail = false
  }
  return doc
}

export function updateUserDocPassword (user: User, newHash: StringifiedHashedSecretData) {
  user.password = newHash
  user = omit(user, 'resetPassword')
  // Also change the read token, following Github practice
  // https://github.com/blog/16-token-private-feeds
  user.readToken = generateReadToken()
  return user
}

export const setUserDocOauthTokens = (provider: OAuthProvider, data: OAuthProviderUserData) => (user: User) => {
  assertString(provider)
  assertObject(data)
  assertString(data.token)
  assertString(data.token_secret)
  user.oauth = user.oauth || {}
  user.oauth[provider] = data
  return user
}

export const updateUserItemsCounts = itemsCounts => (user: DocWithUsernameInUserDb) => {
  // This function is used by db.update and should thus always return a user doc
  // even if unmodified
  if (user.type === 'deleted') return user
  assertObject(itemsCounts.private)
  assertObject(itemsCounts.network)
  assertObject(itemsCounts.public)
  Object.assign(user.snapshot, itemsCounts)
  return user
}

export function assertUserRole (role: unknown): asserts role is UserRole {
  assertString(role)
  if (!arrayIncludes(userAttributes.roles, role)) {
    throw newError('unknown role', 400)
  }
}

export const addUserDocRole = (role: UserRole) => (user: User) => {
  assertUserRole(role)
  user.roles = user.roles || []
  if (user.roles.includes(role)) {
    throw newError('user already has role', 400)
  }
  user.roles.push(role)
  return user
}

export const removeUserDocRole = (role: UserRole) => (user: User) => {
  assertUserRole(role)
  user.roles = user.roles || []
  user.roles = without(user.roles, role)
  return user
}

// We need a stable username for services that use the username as unique user id
// such as wiki.inventaire.io (https://github.com/inventaire/inventaire-mediawiki)
export function setUserDocStableUsername (user: User) {
  user.stableUsername = user.stableUsername || user.username
  return user
}

export function userShouldBeAnonymized (user: Pick<User, 'settings'>) {
  const userSetting = get(user, 'settings.contributions.anonymize')
  return userSetting !== false
}

export const userFormatters = {
  username: normalizeString,
  position: truncateLatLng,
}
