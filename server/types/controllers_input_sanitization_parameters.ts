import type { Context } from '#types/activity'
import type { BBox, ColorHexCode, LatLng, Url } from '#types/common'
import type { CouchUuid } from '#types/couchdb'
import type { Claims, EntityUri, Labels, PropertyUri } from '#types/entity'
import type { GroupId } from '#types/group'
import type { ImageHash } from '#types/image'
import type { ItemId } from '#types/item'
import type { ListingId } from '#types/listing'
import type { PatchId } from '#types/patch'
import type { UserAccountUri } from '#types/server'
import type { ShelfId } from '#types/shelf'
import type { TransactionId } from '#types/transaction'
import type { Email, UserId, Username } from '#types/user'
import type { VisibilityKey } from '#types/visibility'

// It might be possible to deduce those types from sanitizationParameters values
// but that might produce some hellish type code. It could be worth it if that allows
// to better take into account the actual controllers sanitization configs

// Match the keys in sanitizationParameters from server/lib/sanitize/parameters.ts
interface WellknownSanitizedParameters {
  '@context': Context[]
  actor: string
  attribute: string
  attributes: string[]
  bbox: BBox
  color: ColorHexCode
  comment: string
  context: string
  'entities-type': string
  email: Email
  emails: Email[]
  description: string
  filter: string
  format: string[]
  from: EntityUri
  // generics,
  group: GroupId
  id: CouchUuid
  ids: CouchUuid[]
  isbn: string
  item: ItemId
  items: ItemId[]
  lang: string
  langs: string[]
  limit: number
  list: ListingId
  lists: ListingId[]
  message: string
  name: string
  object: string
  offset: number
  options: string[]
  ordinal: number
  owners: UserId[]
  password: string
  patch: PatchId
  position: LatLng
  prefix: string
  property: PropertyUri
  range: number
  refresh: boolean
  resource: string
  search: string
  shelf: ShelfId
  slug: string
  state: string
  title: string
  token: string
  transaction: TransactionId
  type: string
  types: string[]
  to: EntityUri
  uri: EntityUri
  uris: EntityUri[]
  url: Url | ImageHash
  user: UserId
  users: UserId[]
  username: Username
  usernames: Username[]
  relatives: PropertyUri[]
  requester: UserId
  // Endpoints accepting a 'value' can specify a type
  // or have to do their own validation
  // as a value can be anything, including null
  value: unknown
  visibility: VisibilityKey[]
}

interface GenericsBasedSanitizedParameters {
  height: number
  open: boolean
  redirect: boolean
  searchable: boolean
  sort: boolean
  width: number
  labels: Labels
  claims: Claims
}

type ClassicDocId = Exclude<string, 'patch'>

interface PatternedSanitizedParameters {
  [key: `assert${string}`]: boolean
  [key: `include${string}`]: boolean
  [key: `strict${string}`]: boolean
  [key: `with${string}`]: boolean
  [key: `${ClassicDocId}Id`]: CouchUuid
  [key: `${string}Acct`]: UserAccountUri
}

interface AliasedSanitizedParameters {
  newValue: WellknownSanitizedParameters['value']
  oldValue: WellknownSanitizedParameters['value']
  newPassword: WellknownSanitizedParameters['password']
  oldPassword: WellknownSanitizedParameters['password']
}

interface OtherSanitizedParameters {
  // Excluded from `${ClassicDocId}Id`
  patchId: PatchId
}

interface RequestParameters {
  reqUserId: UserId
  reqUserAcct: UserAccountUri
}

// TODO: accept `typeof sanitization` as type parameter to customize the controller `params` types
// The difficulty being that some parameters are renamed. Maybe these renaming could be removed.
export type SanitizedParameters = Partial<
  WellknownSanitizedParameters &
  GenericsBasedSanitizedParameters &
  PatternedSanitizedParameters &
  AliasedSanitizedParameters &
  OtherSanitizedParameters &
  RequestParameters
>
