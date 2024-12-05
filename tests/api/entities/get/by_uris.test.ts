import should from 'should'
import { isCouchUuid } from '#lib/boolean_validations'
import { federatedMode } from '#server/config'
import {
  createEdition,
  createEditionWithIsbn,
  createHuman,
  createWorkWithAuthor,
  getSomeRemoteEditionWithALocalLayer,
  getSomeWdEditionUri,
  someFakeUri,
  someRandomImageHash,
} from '#tests/api/fixtures/entities'
import { addClaim, getByUri, getByUris, merge } from '#tests/api/utils/entities'
import { rethrowShouldNotBeCalledErrors, shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { ExpandedSerializedWdEntity, InvEntityUri } from '#types/entity'

let workWithAuthorPromise

describe('entities:get:by-uris', () => {
  before(() => {
    workWithAuthorPromise = createWorkWithAuthor()
  })
  it('should reject invalid uri', async () => {
    const invalidUri = 'bla'
    try {
      // @ts-expect-error
      await getByUris(invalidUri)
      .then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid uri')
    }
  })

  it('should reject uri with wrong prefix', async () => {
    const invalidUri = 'foo:Q535'
    try {
      // @ts-expect-error
      await getByUris(invalidUri)
      .then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid uri')
    }
  })

  it('should accept inventaire uri', async () => {
    const work = await workWithAuthorPromise
    const { entities } = await getByUris(work.uri)
    entities[work.uri].should.be.an.Object()
    entities[work.uri].invId.should.be.ok()
  })

  it('should return inventaire uris not found', async () => {
    const { notFound } = await getByUris([ someFakeUri ])
    notFound.should.deepEqual([ someFakeUri ])
  })

  it('should return isbn uris not found', async () => {
    const someMissingIsbn = 'isbn:9789871453023'
    const { notFound } = await getByUris([ someMissingIsbn ])
    notFound.should.deepEqual([ someMissingIsbn ])
  })

  it('should return wikidata uris not found', async () => {
    const nonExistingUri = 'wd:Q5359999999999999'
    const { notFound } = await getByUris([ nonExistingUri ], null, true)
    notFound.should.deepEqual([ nonExistingUri ])
  })

  it('should return wikidata found and not found uris', async () => {
    const existingUri = 'wd:Q1345582'
    const nonExistingUriA = 'wd:Q5359999999999998'
    const nonExistingUriB = 'wd:Q5359999999999999'
    const { entities, notFound } = await getByUris([ existingUri, nonExistingUriA, nonExistingUriB ], null, true)
    entities[existingUri].uri.should.equal(existingUri)
    notFound.should.containEql(nonExistingUriA)
    notFound.should.containEql(nonExistingUriB)
  })

  it('should use isbn uris as canonical uris for wikidata editions with isbns', async () => {
    const wdUri = 'wd:Q116194196'
    const isbnUri = 'isbn:9780375759239'
    const { entities, redirects } = await getByUris([ wdUri ], null, true)
    entities[isbnUri].uri.should.equal(isbnUri)
    redirects[wdUri].should.equal(isbnUri)
  })

  it('should return redirected uris', async function () {
    if (federatedMode) this.skip()
    const [ humanA, humanB, humanC ] = await Promise.all([ createHuman(), createHuman(), createHuman() ])
    const wdHumanUri = 'wd:Q1345582'
    await Promise.all([
      merge(humanA.uri, humanB.uri),
      merge(humanC.uri, wdHumanUri),
    ])
    const { entities, notFound, redirects } = await getByUris([ humanA.uri, humanC.uri ])
    Object.keys(entities).length.should.equal(2)
    entities[humanB.uri].uri.should.equal(humanB.uri)
    entities[wdHumanUri].uri.should.equal(wdHumanUri)
    redirects[humanA.uri].should.equal(humanB.uri)
    redirects[humanC.uri].should.equal(wdHumanUri)
    should(notFound).not.be.ok()
  })

  it('should accept wikidata uri', async () => {
    const validWdUri = 'wd:Q2300248'
    const { entities } = await getByUris([ validWdUri ])
    const entity = entities[validWdUri]
    entity.uri.should.equal(validWdUri)
  })

  it('should accept strict ISBN 13 syntax', async () => {
    const { uri } = await createEditionWithIsbn()
    uri.should.match(/isbn:\d{13}/)
    const { entities } = await getByUris(uri)
    const entity = entities[uri]
    entity.uri.should.equal(uri)
  })

  it('should set terms from claims on editions', async () => {
    const { uri, claims } = await createEdition()
    const { entities } = await getByUris(uri)
    const entity = entities[uri]
    entity.labels.fromclaims.should.equal(claims['wdt:P1476'][0])
    entity.descriptions.fromclaims.should.equal(claims['wdt:P1680'][0])
  })

  it('should get a remote entity with its local layer', async () => {
    const uri = await getSomeWdEditionUri()
    const imageHash = someRandomImageHash()
    await addClaim({ uri, property: 'invp:P2', value: imageHash })
    const entity = (await getByUri(uri) as ExpandedSerializedWdEntity)
    entity.uri.should.equal(uri)
    entity.claims['invp:P1'].should.deepEqual([ uri ])
    entity.claims['invp:P2'].should.deepEqual([ imageHash ])
    entity.wdId.should.equal(uri.split(':')[1])
    should(isCouchUuid(entity.invId)).be.true()
  })

  it('should redirect a local layer uri to the remote entity', async () => {
    const { uri, invId } = await getSomeRemoteEditionWithALocalLayer()
    const invUri: InvEntityUri = `inv:${invId}`
    const res = await getByUris([ invUri ])
    res.entities[uri].claims.should.be.an.Object()
    res.redirects[invUri].should.equal(uri)
  })
})
