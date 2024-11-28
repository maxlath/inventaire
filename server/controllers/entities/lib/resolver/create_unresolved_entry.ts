import type { ResolverBatchParams } from '#controllers/entities/lib/resolver/resolve_update_and_create'
import type { BatchId } from '#types/patch'
import type { EntitySeed, SanitizedResolverEntry } from '#types/resolver'
import type { UserAccountUri } from '#types/server'
import { createEdition, createWork, createAuthor } from './create_entity_from_seed.js'

export async function createUnresolvedEntry (entry: SanitizedResolverEntry, { reqUserAcct, batchId, enrich }: ResolverBatchParams) {
  const { edition, works, authors } = entry

  // If the edition has been resolved but not its associated works
  // creating new works would make them be created without any associated edition
  if (edition.resolved) {
    works.forEach(addNotCreatedFlag)
    authors.forEach(addNotCreatedFlag)
    return entry
  }

  // Create authors before works, so that the created entities uris
  // can be set on the entry, and used in works claims
  await createAuthors(entry, reqUserAcct, batchId)
  // Idem for works being created before the edition
  await createWorks(entry, reqUserAcct, batchId)
  await createEdition(edition, works, reqUserAcct, batchId, enrich)
  return entry
}

function createAuthors (entry: SanitizedResolverEntry, reqUserAcct: UserAccountUri, batchId: BatchId) {
  const { authors } = entry
  return Promise.all(authors.map(createAuthor(reqUserAcct, batchId)))
}

function createWorks (entry: SanitizedResolverEntry, reqUserAcct: UserAccountUri, batchId: BatchId) {
  const { works, authors } = entry
  return Promise.all(works.map(createWork(reqUserAcct, batchId, authors)))
}

function addNotCreatedFlag (seed: EntitySeed) {
  seed.created = false
}
