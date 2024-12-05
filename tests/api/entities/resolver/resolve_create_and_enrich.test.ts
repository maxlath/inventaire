import should from 'should'
import { federatedMode } from '#server/config'
import { deleteByUris, deleteByExternalId } from '#tests/api/utils/entities'
import { uploadSomeImage } from '#tests/api/utils/images'
import { authReq } from '#tests/api/utils/utils'
import type { ResolverEntry } from '#types/resolver'

describe('entities:resolve:create-and-enrich', () => {
  // This tests requires to have config.dataseed.enabled = true
  xit('should be off by default', async () => {
    // An image is expected to be found by dataseed for this isbn
    const isbn = '9782070368228'
    // Make sure the resolver will have to create the edition
    await deleteByUris([ `isbn:${isbn}` ])
    const edition = await resolveCreateAndEnrichEdition({
      edition: { isbn },
      works: [ { labels: { fr: '1984' } } ],
    })
    edition.isbn.should.equal(isbn)
    should(edition.claims['invp:P2']).not.be.ok()
  })

  // This tests requires to have config.dataseed.enabled = true
  xit('should create an edition with an image', async () => {
    // An image is expected to be found by dataseed for this isbn
    const isbn = '9782070375165'
    // Make sure the resolver will have to create the edition
    await deleteByUris([ `isbn:${isbn}` ])
    const edition = await resolveCreateAndEnrichEdition({
      edition: { isbn },
      works: [ { labels: { fr: 'La Ferme des animaux' } } ],
    }, true)
    edition.isbn.should.equal(isbn)
    should(edition.claims['invp:P2']).be.ok()
  })

  // This tests requires to have config.dataseed.enabled = true
  xit('should not try to enrich an edition seed that already has an image claim', async () => {
    // An image is expected to be found by dataseed for this isbn
    const isbn = '9782070375165'
    // Make sure the resolver will have to create the edition
    await deleteByUris([ `isbn:${isbn}` ])
    const { hash } = await uploadSomeImage({ container: 'entities', preventAutoRemove: true })
    const edition = await resolveCreateAndEnrichEdition({
      edition: {
        isbn,
        claims: {
          'invp:P2': [ hash ],
        },
      },
      works: [ { labels: { fr: 'La Ferme des animaux' } } ],
    }, true)
    edition.isbn.should.equal(isbn)
    edition.claims['invp:P2'].should.deepEqual([ hash ])
  })

  it('should not crash if no isbn is set', async function () {
    if (federatedMode) this.skip()
    const goodreadsEditionIdProperty = 'wdt:P2969'
    const goodreadsEditionId = '32687007'
    await deleteByExternalId(goodreadsEditionIdProperty, goodreadsEditionId)
    const edition = await resolveCreateAndEnrichEdition({
      edition: {
        claims: {
          'wdt:P1476': [ 'The Phantom Castle' ],
          // This is a valid entry, as it has an external id
          [goodreadsEditionIdProperty]: [ goodreadsEditionId ],
        },
      },
    }, true)
    edition.uri.should.startWith('inv:')
  })
})

const resolveCreateAndEnrichEdition = async (entry, enrich?) => {
  const { entries } = await resolveCreateAndEnrich(entry, enrich)
  const { edition } = entries[0]
  edition.resolved.should.be.false()
  edition.created.should.be.true()
  return edition
}

const resolveCreateAndEnrich = async (entry, enrich) => {
  const data: {
    entries: ResolverEntry[]
    create: boolean
    enrich?: boolean
  } = {
    entries: [ entry ],
    create: true,
  }
  if (enrich != null) data.enrich = enrich
  return authReq('post', '/api/entities?action=resolve', data)
}
