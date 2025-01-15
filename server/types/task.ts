import type { CouchDoc, CouchUuid } from '#types/couchdb'
import type { SerializedEntity, EntityUri } from '#types/entity'
import type { UserAccountUri } from '#types/server'
import type { EntityType } from 'wikibase-sdk'

export type TaskId = CouchUuid
export type TaskType = 'deduplicate' | 'merge' | 'delete'
export type TaskState = 'processed' | 'dismissed'

export interface externalSourceOccurrence {
  uri: EntityUri
  matchedTitles: string[]
  structuredDataSource: boolean
}

export type Suggestion = SerializedEntity & {
  lexicalScore?: number
  relationScore?: number
  entitiesType: EntityType
  occurrences?: externalSourceOccurrence[]
  reporter?: UserAccountUri
  clue?: string
}

export interface Task extends CouchDoc {
  _id: TaskId
  type: TaskType
  state?: TaskState
  suspectUri: EntityUri
  suggestionUri: EntityUri
  created: EpochTimeStamp
  updated?: EpochTimeStamp
  lexicalScore?: number
  relationScore?: number
  entitiesType: EntityType
  externalSourcesOccurrences?: externalSourceOccurrence[]
  reporters?: UserAccountUri[]
  clue?: string
}
