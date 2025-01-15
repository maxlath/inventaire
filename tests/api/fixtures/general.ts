import { getRandomUuid } from '#lib/crypto'
import type { CouchUuid } from '#types/couchdb'

export const someCouchUuid: CouchUuid = '00000000000000000000000000000000'
export const someRandomCouchUuid = getRandomUuid
