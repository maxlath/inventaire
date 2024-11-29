import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { resolvePublisher } from '#controllers/entities/lib/resolver/resolve_publisher'
import { resolveUpdateAndCreate } from '#controllers/entities/lib/resolver/resolve_update_and_create'
import type { ResolverParams } from '#controllers/entities/resolve'
import { getAuthoritiesAggregatedEntry } from '#data/dataseed/get_authorities_aggregated_entry'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { parseIsbn } from '#lib/isbn/parse'
import temporarilyMemoize from '#lib/temporarily_memoize'
import { logError } from '#lib/utils/logs'
import config from '#server/config'
import type { ResolverEntry } from '#types/resolver'
import { getSeedsByIsbns, type DataSeed } from './dataseed.js'

const seedUserAcct = getLocalUserAcct(hardCodedUsers.seed._id)

const { enabled: dataseedEnabled } = config.dataseed

const resolverParams = {
  create: true,
  update: true,
  strict: true,
  enrich: true,
  reqUserAcct: seedUserAcct,
} satisfies Omit<ResolverParams, 'entries'>

async function _enrichAndGetEditionEntityFromIsbn (isbn: string) {
  try {
    const entry = await getAuthoritiesAggregatedEntry(isbn)
    if (entry) {
      const entity = await enrichAndGetEditionEntityFromEntry(entry)
      if (entity) return entity
    }
    if (dataseedEnabled) {
      const [ seed ] = await getSeedsByIsbns(isbn)
      if (seed?.title) {
        const dataseedEntry = await buildEntryFromDataSeed(seed)
        const entity = await enrichAndGetEditionEntityFromEntry(dataseedEntry)
        if (entity) return entity
        return dataseedEntry
      }
    }
  } catch (err) {
    logError(err, 'enrich_and_get_edition_entity_from_isbn error')
  }
  return { isbn, notFound: true }
}

export const enrichAndGetEditionEntityFromIsbn = temporarilyMemoize({
  fn: _enrichAndGetEditionEntityFromIsbn,
  ttlAfterFunctionCallReturned: 2000,
})

async function enrichAndGetEditionEntityFromEntry (entry: ResolverEntry) {
  const { resolvedEntries } = await resolveUpdateAndCreate({ entries: [ entry ], ...resolverParams })
  const [ resolvedEntry ] = resolvedEntries
  if (resolvedEntry) {
    const { uri } = resolvedEntry.edition
    if (uri) return getEntityByUri({ uri })
  }
}

async function buildEntryFromDataSeed (seed: DataSeed) {
  const { title, authors, image, publisher, publicationDate, isbn } = seed
  const isbnData = parseIsbn(isbn)
  const lang = isbnData.groupLang || 'en'
  const entry = {
    edition: {
      isbn,
      claims: {
        'wdt:P1476': title,
      },
      image,
    },
    works: [
      {
        labels: { [lang]: title },
      },
    ],
    authors: authors.map(authorName => ({
      labels: { [lang]: authorName },
    })),
  }
  if (publicationDate) entry.edition.claims['wdt:P577'] = publicationDate
  if (publisher) {
    const publisherUri = await resolvePublisher(isbn, publisher)
    if (publisherUri) entry.edition.claims['wdt:P123'] = publisherUri
  }
  return entry
}
