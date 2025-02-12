import 'should'
import { randomBytes } from 'node:crypto'
import { isPlainObject, random, round } from 'lodash-es'
import { addUserRole } from '#controllers/user/lib/user'
import { getSomeEmail, getSomeUsername } from '#fixtures/text'
import { getRandomUuid } from '#lib/crypto'
import { newError } from '#lib/error/error'
import { assertString } from '#lib/utils/assert_types'
import { getRandomString } from '#lib/utils/random_string'
import { localOrigin } from '#server/config'
import { makeFriends } from '#tests/api/utils/relations'
import { request, rawRequest } from '#tests/api/utils/request'
import type { Awaitable } from '#tests/api/utils/types'
import { deleteUser } from '#tests/api/utils/users'
import type { AbsoluteUrl, LatLng } from '#types/common'
import type { User, UserRole } from '#types/user'

export type CustomUserData = Record<string, string | number | boolean | number[]>

const authEndpoint = '/api/auth'

let getUser, updateUser
async function importCircularDependencies () {
  ;({ getUser } = await import('#tests/api/utils/utils'))
  ;({ updateUser } = await import('#tests/api/utils/users'))
}
setImmediate(importCircularDependencies)

const connect = (endpoint, userData) => rawRequest('post', endpoint, { body: userData })

function _signup (userData, origin: AbsoluteUrl = localOrigin) {
  return connect(`${origin}${authEndpoint}?action=signup`, userData)
}

async function loginOrSignup (userData, origin = localOrigin) {
  try {
    return await connect(`${origin}${authEndpoint}?action=login`, userData)
  } catch (err) {
    if (err.statusCode !== 401) throw err
    return _signup(userData, origin)
  }
}

export function signup (email) {
  return _signup({
    email,
    username: createUsername(),
    password: randomBytes(8).toString('base64'),
  })
}

async function _getOrCreateUser ({ customData = {}, mayReuseExistingUser, role, origin }: { customData: CustomUserData, mayReuseExistingUser?: boolean, role?: UserRole, origin?: AbsoluteUrl }) {
  const username = customData.username || createUsername()
  const userData = {
    username,
    password: customData.password || '12345678',
    email: `${getRandomString(10)}@adomain.org`,
    language: customData.language || 'en',
  }
  let cookie
  if (mayReuseExistingUser) {
    cookie = await loginOrSignup(userData, origin).then(parseCookie)
  } else {
    cookie = await _signup(userData, origin).then(parseCookie)
  }
  assertString(cookie)
  const user = await getUserWithCookie(cookie, origin)
  await setCustomData(user, customData, origin)
  if (role) {
    if (origin && origin !== localOrigin) {
      throw newError('can set a role on a remote user', 500, { role, origin })
    } else {
      await addUserRole(user._id, role)
    }
  }
  return getUserWithCookie(cookie, origin)
}

export function getOrCreateUser (customData: CustomUserData, role: UserRole, origin?: AbsoluteUrl) {
  return _getOrCreateUser({ customData, role, mayReuseExistingUser: true, origin })
}

export function createUser (customData: CustomUserData = {}) {
  return _getOrCreateUser({ customData, mayReuseExistingUser: false })
}

export interface UserWithCookie extends User {
  cookie: string
  origin: AbsoluteUrl
}

export type AwaitableUserWithCookie = Awaitable<UserWithCookie>

export async function getUserWithCookie (cookie: string, origin: AbsoluteUrl = localOrigin) {
  const user = await request('get', `${origin}/api/user`, null, { cookie })
  user.cookie = cookie
  user.origin = origin
  assertString(user.cookie)
  return user as UserWithCookie
}

export async function getRefreshedUser (user: AwaitableUserWithCookie, origin?: AbsoluteUrl) {
  // Allow to pass either a user doc or a user promise
  user = await user
  // Get the up-to-date user doc while keeping the cookie
  // set by tests/api/fixtures/users
  return getUserWithCookie(user.cookie, origin)
}

export const createUsername = () => getSomeUsername()

export const createUserEmail = () => getSomeEmail()

export async function getUsersWithoutRelation () {
  const [ userA, userB ] = await Promise.all([
    getUser(),
    createUser(),
  ])
  return { userA, userB }
}

export function getRandomPosition () {
  return [
    getRandomLatitude(),
    getRandomLongitude(),
  ] as LatLng
}
export const getRandomLatitude = () => randomCoordinate(-90, 90)
export const getRandomLongitude = () => randomCoordinate(-180, 180)

export async function getTwoFriends () {
  const [ userA, userB ] = await Promise.all([
    getUser(),
    createUser(),
  ])
  await makeFriends(userA, userB)
  return [ userA, userB ]
}

const parseCookie = res => res.headers['set-cookie']

async function setCustomData (user: UserWithCookie, customData: CustomUserData, origin: AbsoluteUrl = localOrigin) {
  delete customData.username
  delete customData.password
  for (const attribute in customData) {
    const value = customData[attribute]
    if (isPlainObject(value)) {
      // ex: 'settings.contributions.anonymize': false
      throw new Error('use object path syntax')
    }
    await updateUser({ user, attribute, value, origin })
  }
}

function randomCoordinate (min: number, max: number) {
  // Let some margin so that no invalid coordinates can be generated
  // from adding/removing less than 5 from any random coordinate composant
  min = min + 5
  max = max - 5
  return round(random(min, max, true), 4)
}

export const someSpamText = 'SEO! https://spamers.corp'

export async function getDeletedUser () {
  const user = await createUser()
  await deleteUser(user)
  return getRefreshedUser(user)
}

export const getSomeRandomAnonymizableId = getRandomUuid
