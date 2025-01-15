import { someRandomCouchUuid } from '#fixtures/general'
import { publicHost } from '#server/config'
import type { UserAccountUri } from '#types/server'

export function someUserAcct () {
  return `${someRandomCouchUuid()}@${publicHost}` as UserAccountUri
}
