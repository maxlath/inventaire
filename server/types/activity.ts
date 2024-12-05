import type { Url, RelativeUrl, AbsoluteUrl } from '#types/common'
import type { CouchDoc, CouchUuid } from '#types/couchdb'
import type { DateValue, EntityUriPrefix } from '#types/entity'
import type { Item } from '#types/item'
import type { Username } from '#types/user'

export type ActivityType = 'Create' | 'Delete' | 'Follow' | 'Undo' | 'Accept' | 'Follow' | 'Note'
export type Context = 'https://www.w3.org/ns/activitystreams' | 'https://w3id.org/security/v1'
export type LocalActorUrl = AbsoluteUrl
export type ActorUrl = AbsoluteUrl

export interface PropertyValueAttachment {
  type: 'PropertyValue'
  name: string
  value?: string
  url?: Url
}

export interface ActivityIcon{
  mediaType: 'image/jpeg'
  type: 'Image' | 'Document'
  url: string
}

export type ShelfActorName = `shelf-${CouchUuid}`
export type EntityActorName = `${EntityUriPrefix}-${CouchUuid}`

export type ActorName = ShelfActorName | EntityActorName | Username
export type ActorKeyId = AbsoluteUrl

export interface ActorActivity {
  '@context': Context[]
  type: 'Person'
  id: ActorUrl
  name: ActorName
  preferredUsername: string
  summary: string
  inbox: Url
  sharedInbox: Url
  outbox: Url
  publicKey: {
    id: ActorKeyId
    owner: ActorUrl
    publicKeyPem?: {
      publicKeyHash: string
    }
  }
  icon?: ActivityIcon
  attachment?: PropertyValueAttachment[]
}

interface BaseActivity {
  '@context'?: any[]
  id: Url
  to?: string[]
  cc?: string[]
  actor?: Url | ActorActivity
  type: ActivityType
}

export interface NameObj {
  name: string
}

export interface UriObj {
  uri: LocalActorUrl
}

interface ItemsObj {
  items: {
    since: EpochTimeStamp
    until: EpochTimeStamp
  }
}

export type ObjectType = NameObj & ItemsObj & Url

export type Actor = NameObj & UriObj

export interface ActivityDoc extends CouchDoc {
  _id: CouchUuid
  type: ActivityType
  actor: Actor
  object: ObjectType
  externalId: Url
  content: string
  created: EpochTimeStamp
  updated: EpochTimeStamp
}

export interface FollowActivity extends BaseActivity {
  type: 'Follow'
  object: Url
}

export interface NoteActivity extends BaseActivity {
  type: 'Note'
  content: string
  published: DateValue
  attachment?: PropertyValueAttachment[]
}

export interface AcceptActivity extends BaseActivity {
  type: 'Accept'
  object: FollowActivity
}

export interface CreateActivity extends BaseActivity {
  type: 'Create'
  object: NoteActivity
  actor?: Url
}

export type PostActivity = AcceptActivity | CreateActivity

export type ActivityId = CouchUuid

interface Note {
  name: string
  actor: AbsoluteUrl
  // Using User.language type
  lang?: string
  parentLink: RelativeUrl
}

export interface ItemNote extends Note {
  allActivitiesItems: Item[]
}

export interface ActivityLink {
  name: 'shelf' | 'inventory' | 'wikidata.org' | string
  url: Url
}

export interface PublicKeyObject {
  id: string
  owner: ActorUrl
  publicKeyPem: string
}

export interface ActorParams {
  actorName: ActorName
  displayName: string
  summary?: string
  imagePath?: string
  links: ActivityLink[]
  attachment?: PropertyValueAttachment[]
}

export interface Outbox {
  '@context': Context[]
  id: Url
  type: 'OrderedCollection'
  first: Url
  next: Url
  totalItems?: number
}

export type BodyTo = (AbsoluteUrl | 'Public')[]
