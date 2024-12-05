import 'should'
import { identity, map } from 'lodash-es'
import entitiesRelationsTemporaryCache from '#controllers/entities/lib/entities_relations_temporary_cache'
import { cacheEntityRelations, getCachedRelations, redirectCachedRelations } from '#controllers/entities/lib/temporarily_cache_relations'
import { createWork, createWorkWithAuthor, createWorkWithSerie, someFakeUri } from '#fixtures/entities'
import { wait } from '#lib/promises'
import { federatedMode } from '#server/config'
import { addClaim, merge } from '#tests/api/utils/entities'
import { publicReq } from '#tests/api/utils/utils'

// We are calling directly cacheEntityRelations, as the cases that use it would require to edit Wikidata,
// so the following tests try to reproduce conditions as close as possible to the real use-cases

// Due to this feature being primarily used to keep data after edits on Wikidata,
// and due to the revalidation on primary data, it's quite hard to test from the API itself.
describe('temporarily cache relations', () => {
  it('should add author relation to cache', async function () {
    if (federatedMode) this.skip()
    const someAuthorUri = 'wd:Q1345582'
    const { uri: workUri } = await createWorkWithAuthor({ uri: someAuthorUri })
    await cacheEntityRelations(workUri)
    const cachedRelationsEntity = await getCachedRelations({
      valueUri: someAuthorUri,
      properties: [ 'wdt:P50' ],
      formatEntity: identity,
    })
    map(cachedRelationsEntity, 'uri').should.containEql(workUri)
  })

  it('should add serie relation to cache', async function () {
    if (federatedMode) this.skip()
    const someSerieUri = 'wd:Q3656893'
    const { uri: workUri } = await createWorkWithSerie({ uri: someSerieUri })
    await cacheEntityRelations(workUri)
    const cachedRelationsEntity = await getCachedRelations({
      valueUri: someSerieUri,
      properties: [ 'wdt:P179' ],
      formatEntity: identity,
    })
    map(cachedRelationsEntity, 'uri').should.containEql(workUri)
  })

  it('should add any entity relation to cache', async function () {
    if (federatedMode) this.skip()
    const someSubjectUri = 'wd:Q8314'
    const { uri: workUri } = await createWork()
    await addClaim(({ uri: workUri, property: 'wdt:P921', value: someSubjectUri }))
    await cacheEntityRelations(workUri)
    const cachedRelationsEntity = await getCachedRelations({
      valueUri: someSubjectUri,
      properties: [ 'wdt:P921' ],
      formatEntity: identity,
    })
    map(cachedRelationsEntity, 'uri').should.containEql(workUri)
  })

  it('should check the primary data', async function () {
    if (federatedMode) this.skip()
    const someSerieUri = 'wd:Q3656893'
    const someUnrelatedWorkUri = 'wd:Q187655'
    const workWithSerie = await createWorkWithSerie({ uri: someSerieUri })
    const { uri: workUri } = workWithSerie
    const serieUri = workWithSerie.claims['wdt:P179'][0]
    await cacheEntityRelations(workUri)
    // Merge with a work entity that doesn't have wdt:P179=wd:Q3656893
    await merge(workUri, someUnrelatedWorkUri)
    // Give some extra time to CouchDB to update its view
    await wait(500)
    const { parts } = await publicReq('get', `/api/entities?action=serie-parts&uri=${serieUri}`)
    const matchingWorks = parts.filter(work => work.uri === someUnrelatedWorkUri)
    // No matchingWorks should be found as the real entity, which is the primary data,
    // doesn't have the corresponding claim
    matchingWorks.length.should.equal(0)
  })

  it('should find redirected claim subjects', async function () {
    if (federatedMode) this.skip()
    const someAuthorUri = 'wd:Q1345582'
    const { uri: workUri } = await createWorkWithAuthor({ uri: someAuthorUri })
    await cacheEntityRelations(workUri)
    const { uri: otherWorkUri } = await createWork()
    await merge(workUri, otherWorkUri)
    const cachedRelationsEntity = await getCachedRelations({
      valueUri: someAuthorUri,
      properties: [ 'wdt:P50' ],
      formatEntity: identity,
    })
    map(cachedRelationsEntity, 'uri').should.containEql(otherWorkUri)
  })

  it('should find a claim subject when the value has been redirected', async function () {
    if (federatedMode) this.skip()
    const redirectedAuthorUri = 'wd:Q1'
    const canonicalAuthorUri = 'wd:Q2'
    await entitiesRelationsTemporaryCache.set(someFakeUri, 'wdt:P50', redirectedAuthorUri)
    await redirectCachedRelations(redirectedAuthorUri, canonicalAuthorUri)
    const subjectsUris = await entitiesRelationsTemporaryCache.get('wdt:P50', canonicalAuthorUri)
    subjectsUris.should.containEql(someFakeUri)
  })
})
