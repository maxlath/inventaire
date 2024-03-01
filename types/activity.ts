import type { CouchDoc } from '#types/common'

export interface Activity extends CouchDoc {
  type: string
  actor: string
  object: string
  externalId: string
  content: string
  created: EpochTimeStamp
  updated: EpochTimeStamp
}
