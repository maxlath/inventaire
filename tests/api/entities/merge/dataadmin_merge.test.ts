import should from 'should'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { prefixifyInv } from '#controllers/entities/lib/prefix'
import {
  createWork,
  createHuman,
  createEdition,
  createEditionWithIsbn,
  createItemFromEntityUri,
  createWorkWithAuthor,
  someFakeUri,
  getSomeRemoteEditionWithALocalLayer,
  someRandomImageHash,
  getSomeWdEditionUri,
  existsOrCreate,
} from '#fixtures/entities'
import { getRandomString } from '#lib/utils/random_string'
import { federatedMode } from '#server/config'
import { getByUris, merge, getHistory, addClaim, getByUri } from '#tests/api/utils/entities'
import { getItemsByIds } from '#tests/api/utils/items'
import { dataadminReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { InvEntityUri } from '#types/entity'

describe('entities:merge:as:dataadmin', () => {
  it('should reject without from uri', async function () {
    if (federatedMode) this.skip()
    await dataadminReq('put', '/api/entities?action=merge')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: from')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject without to uri', async function () {
    if (federatedMode) this.skip()
    await dataadminReq('put', '/api/entities?action=merge', { from: someFakeUri })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: to')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid uris', async function () {
    if (federatedMode) this.skip()
    await dataadminReq('put', '/api/entities?action=merge', { from: 'fromUri', to: 'toUri' })
  .then(shouldNotBeCalled)
  .catch(err => {
    err.body.status_verbose.should.startWith('invalid from:')
    err.statusCode.should.equal(400)
  })
  })

  it('should reject invalid from prefix', async function () {
    if (federatedMode) this.skip()
    await dataadminReq('put', '/api/entities?action=merge', { from: 'wd:Q42', to: someFakeUri })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith("invalid 'from' uri domain: wd. Accepted domains: inv,isbn")
      err.statusCode.should.equal(400)
    })
  })

  it('should return uris not found', async function () {
    if (federatedMode) this.skip()
    await dataadminReq('put', '/api/entities?action=merge', { from: someFakeUri, to: 'wd:Q42' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("'from' entity not found")
      err.statusCode.should.equal(400)
    })
  })

  it('should merge two entities with an inv URI', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB ] = await Promise.all([
      createWork(),
      createWork(),
    ])
    await merge(workA.uri, workB.uri)
    const { entities, redirects } = await getByUris(workA.uri)
    redirects[workA.uri].should.equal(workB.uri)
    entities[workB.uri].should.be.ok()
  })

  it('should merge entities with inv and isbn URIs', async function () {
    if (federatedMode) this.skip()
    const [ editionA, editionB ] = await Promise.all([
      createEdition(),
      createEditionWithIsbn(),
    ])
    const item = await createItemFromEntityUri({ uri: editionA.uri })
    item.entity.should.equal(editionA.uri)
    await merge(editionA.uri, editionB.uri)
    const [ { entities, redirects }, { items } ] = await Promise.all([
      getByUris(editionA.uri),
      getItemsByIds(item._id),
    ])
    redirects[editionA.uri].should.equal(editionB.uri)
    entities[editionB.uri].should.be.ok()
    items[0].entity.should.equal(editionB.uri)
  })

  it('should merge an entity with an ISBN', async function () {
    if (federatedMode) this.skip()
    const [ editionA, editionB ] = await Promise.all([
      createEditionWithIsbn(),
      createEdition(),
    ])
    const item = await createItemFromEntityUri({ uri: editionB.uri })
    await merge(editionA.uri, editionB.uri)
    const [ { entities, redirects }, { items } ] = await Promise.all([
      getByUris(editionB.uri),
      getItemsByIds(item._id),
    ])
    const updatedEditionB = entities[redirects[editionB.uri]]
    updatedEditionB.claims['wdt:P212'].should.deepEqual(editionA.claims['wdt:P212'])
    const isbnUri = editionA.uri
    items[0].entity.should.equal(isbnUri)
  })

  it('should reject merge with different ISBNs', async function () {
    if (federatedMode) this.skip()
    const [ editionA, editionB ] = await Promise.all([
      createEditionWithIsbn(),
      createEditionWithIsbn(),
    ])
    await merge(editionA.uri, editionB.uri)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("can't merge editions with different ISBNs")
      err.statusCode.should.equal(400)
    })
  })

  it('should transfer claims', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB ] = await Promise.all([
      createWork(),
      createWork(),
    ])
    await addClaim({ uri: workA.uri, property: 'wdt:P50', value: 'wd:Q535' })
    await merge(workA.uri, workB.uri)
    const { entities } = await getByUris(workB.uri)
    const authorsUris = entities[workB.uri].claims['wdt:P50']
    authorsUris.should.deepEqual([ 'wd:Q535' ])
  })

  it('should transfer labels', async function () {
    if (federatedMode) this.skip()
    const label = getRandomString(6)
    const [ workA, workB ] = await Promise.all([
      createWork({ labels: { zh: label } }),
      createWork(),
    ])
    await merge(workA.uri, workB.uri)
    const { entities } = await getByUris(workB.uri)
    entities[workB.uri].labels.zh.should.equal(label)
  })

  it('should keep track of the patch context', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB ] = await Promise.all([
      createWork(),
      createWork(),
    ])
    await addClaim({ uri: workA.uri, property: 'wdt:P50', value: 'wd:Q535' })
    await merge(workA.uri, workB.uri)
    const patches = await getHistory(workB._id)
    patches[1].context.mergeFrom.should.equal(workA.uri)
  })

  it('should redirect claims', async function () {
    if (federatedMode) this.skip()
    const [ humanA, humanB, work ] = await Promise.all([
      createHuman(),
      createHuman(),
      createWork(),
    ])
    await addClaim({ uri: work.uri, property: 'wdt:P50', value: humanA.uri })
    await merge(humanA.uri, humanB.uri)
    const { entities } = await getByUris(work.uri)
    const authorsUris = entities[work.uri].claims['wdt:P50']
    authorsUris.should.deepEqual([ humanB.uri ])
    const patches = await getHistory(work._id)
    // patch 0: create the work entity
    // patch 1: add a wdt:P50 claim pointing to to humanA
    // patch 2: redirect to humanB
    patches[2].context.redirectClaims.should.deepEqual({ fromUri: humanA.uri })
  })

  it('should recover from parallel edit conflicts while redirecting claims', async function () {
    if (federatedMode) this.skip()
    const [ humanA, humanB, humanC, workX, workY, workZ ] = await Promise.all([
      createHuman(),
      createHuman(),
      createHuman(),
      createWork(),
      createWork(),
      createWork(),
    ])
    await Promise.all([
      // workX will have both soon-to-be redirected authors, which should trigger a conflict
      // when trying to redirect claims at the same time
      addClaim({ uri: workX.uri, property: 'wdt:P50', value: humanA.uri }),
      addClaim({ uri: workX.uri, property: 'wdt:P50', value: humanB.uri }),
      // while workY and workZ should have their claims redirected without problem on the first attempt
      // but are here to control that it doesn't raise an issue when retrying to redirect claims
      // due to the conflict above
      addClaim({ uri: workY.uri, property: 'wdt:P50', value: humanA.uri }),
      addClaim({ uri: workZ.uri, property: 'wdt:P50', value: humanB.uri }),
    ])
    await Promise.all([
      merge(humanA.uri, humanC.uri),
      merge(humanB.uri, humanC.uri),
    ])
    const { entities } = await getByUris(workX.uri)
    const authorsUris = entities[workX.uri].claims['wdt:P50']
    authorsUris.should.deepEqual([ humanC.uri ])
    const patches = await getHistory(workX._id)
    const { fromUri: fromUri1 } = patches.at(-2).context.redirectClaims
    const { fromUri: fromUri2 } = patches.at(-1).context.redirectClaims
    fromUri1.should.not.equal(fromUri2)
    should(fromUri1 === humanA.uri || fromUri1 === humanB.uri).be.true()
    should(fromUri1 === humanA.uri || fromUri1 === humanB.uri).be.true()
  })

  it('should reject a merge from a redirection', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB, workC ] = await Promise.all([
      createWork(),
      createWork(),
      createWork(),
    ])
    await merge(workA.uri, workB.uri)
    await merge(workA.uri, workC.uri)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("'from' entity is already a redirection")
    })
  })

  it('should reject a merge to a redirection', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB, workC ] = await Promise.all([
      createWork(),
      createWork(),
      createWork(),
    ])
    await merge(workA.uri, workB.uri)
    await merge(workC.uri, workA.uri)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("'to' entity is already a redirection")
    })
  })

  it('should reject a circular merge', async function () {
    if (federatedMode) this.skip()
    const work = await createWork()
    await merge(work.uri, work.uri)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("can't merge an entity into itself")
    })
  })

  it('should remove isolated human "placeholders" entities on works merge', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB ] = await Promise.all([
      createWorkWithAuthor(),
      createWorkWithAuthor(),
    ])
    const humanAUri = workA.claims['wdt:P50'][0]
    await merge(workA.uri, workB.uri)
    const { entities } = await getByUris(humanAUri)
    const entity = entities[humanAUri]
    entity._meta_type.should.equal('removed:placeholder')
  })

  it('should merge an entity with a non-canonical uri', async function () {
    if (federatedMode) this.skip()
    const [ editionA, editionB ] = await Promise.all([
      createEditionWithIsbn(),
      createEdition(),
    ])
    editionA.uri.should.startWith('isbn')
    await merge(`inv:${editionA._id}`, editionB.uri)
  })

  describe('local entity layer', () => {
    it('should turn a merged local entity into a local entity layer if there is none', async function () {
      if (federatedMode) this.skip()
      const imageHash = someRandomImageHash()
      const edition = await createEdition({ image: imageHash })
      const uri = await getSomeWdEditionUri()
      await merge(edition.uri, uri)
      const updatedEdition = await getByUri(uri)
      updatedEdition.claims['invp:P1'].should.deepEqual([ uri ])
      updatedEdition.claims['invp:P2'].should.deepEqual([ imageHash ])
      let invId
      if ('invId' in updatedEdition) invId = updatedEdition.invId
      invId.should.equal(edition._id)
    })

    it('should turn a merged local entity into a redirection if there is already a local layer', async function () {
      if (federatedMode) this.skip()
      const imageHashA = someRandomImageHash()
      const imageHashB = someRandomImageHash()
      const [ uri, editionA, editionB ] = await Promise.all([
        getSomeWdEditionUri(),
        createEdition({ image: imageHashA }),
        createEdition({ image: imageHashB }),
      ])
      await merge(editionA.uri, uri)
      await merge(editionB.uri, uri)
      const { entities, redirects } = await getByUris([ editionB.uri ])
      redirects[editionB.uri].should.equal(uri)
      entities[uri].invId.should.equal(editionA._id)
      entities[uri].claims['invp:P2'].should.deepEqual([ imageHashA ])
    })

    it('should reject merging a local entity layer', async function () {
      if (federatedMode) this.skip()
      const entity = await getSomeRemoteEditionWithALocalLayer()
      const { invId } = entity
      const invUri: InvEntityUri = `inv:${invId}`
      const edition = await createEdition()
      await merge(invUri, edition.uri)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal("'from' uri refers to a local entity layer")
      })
    })

    it('should reject merging into a local entity layer', async function () {
      if (federatedMode) this.skip()
      const entity = await getSomeRemoteEditionWithALocalLayer()
      const { invId } = entity
      const invUri: InvEntityUri = `inv:${invId}`
      const edition = await createEdition()
      await merge(edition.uri, invUri)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal("'to' uri refers to a local entity layer")
      })
    })

    it('should reject merging into a missing remote entity', async function () {
      if (federatedMode) this.skip()
      const human = await createHuman()
      const wdHumanUri = 'wd:Q104211857'
      await merge(human.uri, wdHumanUri)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal("'to' entity not found")
      })
    })

    it('should merge a local entity with the same isbn as a remote entity into that remote entity', async function () {
      if (federatedMode) this.skip()
      const isbn = '978-2-7186-0660-6'
      const property = 'wdt:P212'
      const edition = await existsOrCreate({
        createFn: createEdition,
        claims: {
          [property]: [ isbn ],
        },
      })
      const invUri = prefixifyInv(edition.invId)
      await merge(invUri, 'wd:Q130646886')
      const entity = await getEntityByUri({ uri: invUri })
      // @ts-expect-error
      entity.wdId.should.equal('Q130646886')
    })

    // Claim transfer are actually just cherry-picked claim copies done in the client
    // it('should transfer local claims to target local entity layer')
    // it('should transfer merged remote entity local claims to target entity local layer')
  })
})
