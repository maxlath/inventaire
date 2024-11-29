import { isPlainObject, isString } from 'lodash-es'
import { isItemId as isWikidataItemId } from 'wikibase-sdk'
import * as regex_ from '#lib/regex'
import config from '#server/config'
import type { LocalActorUrl } from '#types/activity'
import type { AbsoluteUrl, ColorHexCode } from '#types/common'
import type { CouchUuid } from '#types/couchdb'
import type { InvEntityUri, IsbnEntityUri, WdEntityUri, EntityUri, PropertyUri, InvPropertyUri, WdPropertyUri, WdEntityId } from '#types/entity'
import type { AssetImagePath, EntityImagePath, GroupImagePath, ImageHash, ImagePath, UserImagePath } from '#types/image'
import type { PatchId } from '#types/patch'
import type { AuthentifiedReq, Req, UserAccountUri } from '#types/server'
import type { Email, Username } from '#types/user'
import type { VisibilityGroupKey } from '#types/visibility'
import { isNormalizedIsbn } from './isbn/isbn.js'

const { PositiveInteger: PositiveIntegerPattern } = regex_
const publicOrigin = config.getPublicOrigin()

function bindedTest <T extends string> (regexName: keyof typeof regex_) {
  return function (str: unknown): str is T {
    return typeof str === 'string' && regex_[regexName].test(str)
  }
}

export const isNonEmptyString = (str: unknown): str is (Exclude<string, ''>) => typeof str === 'string' && str.length > 0

export function isUrl (url: unknown): url is AbsoluteUrl {
  if (typeof url !== 'string') return false
  try {
    const { protocol, username, password } = new URL(url)
    if (!(protocol === 'http:' || protocol === 'https:')) return false
    if (username !== '' || password !== '') return false
  } catch (err) {
    if (err.code === 'ERR_INVALID_URL') return false
    else throw err
  }
  return true
}

export const isCouchUuid = bindedTest<CouchUuid>('CouchUuid')
export const isColorHexCode = bindedTest<ColorHexCode>('ColorHexCode')
export const isImageHash = bindedTest<ImageHash>('ImageHash')
export const isAssetImg = bindedTest<AssetImagePath>('AssetImg')
export const isEntityImg = bindedTest<EntityImagePath>('EntityImg')
export const isGroupImg = bindedTest<GroupImagePath>('GroupImg')
export const isLocalImg = bindedTest<ImagePath>('LocalImg')
export const isUserImg = bindedTest<UserImagePath>('UserImg')
export const isLang = bindedTest('Lang')
export const isInvEntityId = isCouchUuid
export const isWdEntityId = bindedTest<WdEntityId>('WdEntityId')

export function isInvEntityUri (uri: string): uri is InvEntityUri {
  if (!isNonEmptyString(uri)) return false
  const [ prefix, id ] = uri.split(':')
  return (prefix === 'inv') && isCouchUuid(id)
}

export function isIsbnEntityUri (uri: string): uri is IsbnEntityUri {
  if (!isNonEmptyString(uri)) return false
  const [ prefix, id ] = uri.split(':')
  return (prefix === 'isbn') && isNormalizedIsbn(id)
}

export function isWdEntityUri (uri: string): uri is WdEntityUri {
  if (!isNonEmptyString(uri)) return false
  const [ prefix, id ] = uri.split(':')
  return (prefix === 'wd') && isWikidataItemId(id)
}

export const isEntityId = id => isWikidataItemId(id) || isInvEntityId(id)
export const isEmail = bindedTest<Email>('Email')
export const isUserId = isCouchUuid
export const isTransactionId = isCouchUuid
export const isGroupId = isCouchUuid
export const isItemId = isCouchUuid
export const isUsername = bindedTest<Username>('Username')
export const isEntityUri = bindedTest<EntityUri>('EntityUri')
export const isPatchId = bindedTest<PatchId>('PatchId')
export const isPropertyUri = bindedTest<PropertyUri>('PropertyUri')
export const isInvPropertyUri = bindedTest<InvPropertyUri>('InvPropertyUri')
export const isWdPropertyUri = bindedTest<WdPropertyUri>('WdPropertyUri')
export function isExpandedEntityUri (uri) {
  const [ prefix, id ] = uri.split(':')
  // Accept alias URIs.
  // Ex: twitter:Bouletcorp -> wd:Q1524522
  return isNonEmptyString(prefix) && isNonEmptyString(id)
}

function isHost (str: string) {
  try {
    const { host } = new URL(`http://${str}`)
    return str === host
  } catch (err) {
    if (err.code !== 'ERR_INVALID_URL') throw err
    return false
  }
}

export function isUserAcct (str: unknown): str is UserAccountUri {
  if (typeof str !== 'string') return false
  const [ handle, host ] = str.split('@')
  return isUserId(handle) && isHost(host)
}

export function isSimpleDay (str) {
  let isValidDate = false
  try {
    // This line will throw if the date is invalid
    // Ex: '2018-03-32' or '2018-02-30'
    const isoDate = (new Date(str)).toISOString()
    // Keep only the passed precision
    const truncatedIsoDate = isoDate.slice(0, str.length)
    isValidDate = truncatedIsoDate === str
  } catch (err) {
    // RangeError is throwned by calling toISOString on an InvalidDate object
    if (err.name === 'RangeError') isValidDate = false
    else throw err
  }

  return isValidDate && regex_.SimpleDay.test(str)
}

// Using a custom implementation of isArray, rather than lodash version, to get better types
export const isArray = (array: unknown): array is unknown[] => array instanceof Array
export const isNonEmptyArray = array => isArray(array) && (array.length > 0)
export function isNonEmptyPlainObject (obj): obj is Record<string | number, unknown> {
  return isPlainObject(obj) && (Object.keys(obj).length > 0)
}
export const isPositiveIntegerString = (str: string) => isString(str) && PositiveIntegerPattern.test(str)
export const isStrictlyPositiveInteger = (num: number) => Number.isInteger(num) && num > 0
export const isNonNegativeInteger = (num: number) => Number.isInteger(num) && num >= 0
export const isExtendedUrl = (str: string) => isUrl(str) || isLocalImg(str)
export const isCollection = array => isArray(array) && array.every(isPlainObject)

export function isLocalActivityPubActorUrl (url: string): url is LocalActorUrl {
  if (!isUrl(url)) return false
  const { origin, pathname, searchParams } = new URL(url)
  if (origin !== publicOrigin) return false
  if (pathname !== '/api/activitypub') return false
  if (searchParams.get('action') !== 'actor') return false
  return isNonEmptyString(searchParams.get('name'))
}

export function isVisibilityGroupKey (value: string): value is VisibilityGroupKey {
  const [ prefix, id ] = value.split(':')
  return prefix === 'group' && isCouchUuid(id)
}

export function isAuthentifiedReq (req: Req): req is AuthentifiedReq {
  return 'user' in req && req.user != null
}
