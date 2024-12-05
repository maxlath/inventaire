import should from 'should'
import { toIsbn13 } from '#lib/isbn/isbn'
import { federatedMode } from '#server/config'
import {
  createEditionWithIsbn,
  existsOrCreate,
  generateIsbn13,
  createEdition,
} from '#tests/api/fixtures/entities'
import { deleteByUris, getByUri, getByUris } from '#tests/api/utils/entities'
import { authReq, publicReq } from '#tests/api/utils/utils'
import type { InvEntityUri, IsbnEntityUri } from '#types/entity'

describe('entities:get:by-isbns', () => {
  it('should return existing edition', async () => {
    const { uri } = await createEditionWithIsbn()
    const res = await getByUris(uri)
    res.entities[uri].should.be.an.Object()
    res.entities[uri].uri.should.equal(uri)
    should(res.notFound).not.be.ok()
  })

  describe('wikidata editions', () => {
    it('should find Wikidata edition entities by its isbn uri', async () => {
      const wdUri = 'wd:Q116194196'
      const isbnUri = 'isbn:9780375759239'
      const entity = await getByUri(isbnUri)
      entity.uri.should.equal(isbnUri)
      entity.claims['invp:P1'].should.deepEqual([ wdUri ])
    })

    it('should find Wikidata edition entities by its wd uri', async () => {
      const wdUri = 'wd:Q116194196'
      const isbnUri = 'isbn:9780375759239'
      const res = await getByUris([ wdUri ])
      res.redirects[wdUri].should.equal(isbnUri)
      res.entities[isbnUri].should.be.an.Object()
    })

    it('should find Wikidata edition with only an ISBN 10 by their ISBN 10 uri', async () => {
      const wdUri = 'wd:Q47224089'
      const isbn10 = '0890092672'
      const isbn10Uri = `isbn:${isbn10}`
      const isbn13Uri = `isbn:${toIsbn13(isbn10)}`
      const res = await getByUris([ isbn10Uri ])
      const entity = res.entities[isbn13Uri]
      entity.uri.should.equal(isbn13Uri)
      entity.claims['invp:P1'].should.deepEqual([ wdUri ])
      res.redirects[isbn10Uri].should.equal(isbn13Uri)
    })

    it('should find Wikidata edition with only an ISBN 10 by their ISBN 13 uri', async () => {
      const wdUri = 'wd:Q47224089'
      const isbn10 = '0890092672'
      const isbn13Uri: IsbnEntityUri = `isbn:${toIsbn13(isbn10)}`
      const res = await getByUris([ isbn13Uri ])
      const entity = res.entities[isbn13Uri]
      entity.uri.should.equal(isbn13Uri)
      entity.claims['invp:P1'].should.deepEqual([ wdUri ])
    })

    it('should leave priority to local edition entities', async () => {
      // Case found with this request https://w.wiki/AtT2
      // const wdUri = 'wd:Q124502194'
      const isbn13h = '978-0-330-50857-5'
      const isbnUri = `isbn:${isbn13h.replaceAll('-', '')}` as InvEntityUri
      const localEdition = await existsOrCreate({
        claims: {
          'wdt:P212': [ isbn13h ],
        },
        createFn: createEdition,
      })
      const entity = await getByUri(isbnUri)
      // @ts-expect-error
      should(entity.wdId).not.be.ok()
      should(entity.claims['invp:P1']).not.be.ok()
      should(entity.invId).equal(localEdition._id)
    })
  })

  describe('autocreate', () => {
    it('should return editions isbn in notFound array when autocreation is false', async () => {
      const uri = `isbn:${generateIsbn13()}`
      const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
      res.entities.should.deepEqual({})
      res.notFound[0].should.equal(uri)
    })

    it('should return editions isbn in notFound array when autocreation is true', async function () {
      if (federatedMode) this.skip()
      const isbnUnknownBySeedsSources = '9783981898743'
      const uri = `isbn:${isbnUnknownBySeedsSources}`
      await deleteByUris([ uri ])
      const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`)
      res.entities.should.deepEqual({})
      res.notFound[0].should.equal(uri)
    })

    it('should autocreate from authorities seed when autocreation is true', async function () {
      if (federatedMode) this.skip()
      const isbnKnownBySeedsSources = '9782207116746'
      const uri = `isbn:${isbnKnownBySeedsSources}`
      await deleteByUris([ uri ])
      const { notFound } = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
      notFound.should.deepEqual([ uri ])
      const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`)
      const entity = res.entities[uri]
      entity.should.be.an.Object()
      entity.uri.should.equal(uri)
      should(res.notFound).not.be.ok()
    })

    // Requires a running dataseed service and config.dataseed.enabled=true
    xit('should autocreate from dataseed seed when autocreation is true', async () => {
      const isbnKnownByDataseed = '9783030917043'
      const uri = `isbn:${isbnKnownByDataseed}`
      await deleteByUris([ uri ])
      const { notFound } = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
      notFound.should.deepEqual([ uri ])
      const res = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`)
      const entity = res.entities[uri]
      entity.should.be.an.Object()
      entity.uri.should.equal(uri)
      should(res.notFound).not.be.ok()
    })

    it('should not create duplicates when called in parallel', async function () {
      if (federatedMode) this.skip()
      const isbnKnownBySeedsSources = '9782207116746'
      const uri = `isbn:${isbnKnownBySeedsSources}`
      await deleteByUris([ uri ])
      const { notFound } = await authReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=false`)
      notFound.should.deepEqual([ uri ])
      const [ res1, res2 ] = await Promise.all([
        publicReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`),
        publicReq('get', `/api/entities?action=by-uris&uris=${uri}&autocreate=true`),
      ])
      const entity1 = res1.entities[uri]
      const entity2 = res2.entities[uri]
      entity1._id.should.equal(entity2._id)
    })
  })
})
