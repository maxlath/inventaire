import should from 'should'
import {
  createHuman,
  createWork,
  createWorkWithAuthor,
  createEdition,
  createEditionWithIsbn,
} from '#fixtures/entities'
import { wait } from '#lib/promises'
import config, { federatedMode } from '#server/config'
import { getByUri, getByUris, deleteByUris } from '#tests/api/utils/entities'
import { getItemById } from '#tests/api/utils/items'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { SerializedInvEntity, EntityUri } from '#types/entity'

const debounceDelay = config.snapshotsDebounceTime + 100

describe('entities:delete', () => {
  it('should reject without uris', async () => {
    await authReq('post', '/api/entities?action=delete')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: uris')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject empty array as uris', async () => {
    await authReq('post', '/api/entities?action=delete', { uris: [] })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("uris array can't be empty")
      err.statusCode.should.equal(400)
    })
  })

  it('should reject non-inv URIs', async function () {
    if (federatedMode) this.skip()
    await deleteByUris([ 'wd:Q535' ])
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid uri: wd:Q535')
      err.statusCode.should.equal(400)
    })
  })

  it('should turn entity into removed:placeholder', async function () {
    if (federatedMode) this.skip()
    const { uri } = await createHuman()
    await deleteByUris([ uri ])
    const entity = await getByUri(uri) as SerializedInvEntity
    entity._meta_type.should.equal('removed:placeholder')
  })

  it('should remove several entities', async function () {
    if (federatedMode) this.skip()
    const [ entityA, entityB ] = await Promise.all([
      createHuman(),
      createWork(),
    ])
    const uris = [ entityA.uri, entityB.uri ]
    await deleteByUris(uris)
    const { entities: entitiesRes } = await getByUris(uris)
    const entities = Object.values(entitiesRes) as SerializedInvEntity[]
    entities[0]._meta_type.should.equal('removed:placeholder')
  })

  it('should delete claims where the entity is the value', async function () {
    if (federatedMode) this.skip()
    const work = await createWorkWithAuthor()
    const authorUri = work.claims['wdt:P50'][0]
    await deleteByUris([ authorUri ])
    const updatedWork = await getByUri(work.uri)
    should(updatedWork.claims['wdt:P50']).not.be.ok()
  })

  // Entities with more than one claim should be turned into redirections
  it('should reject when values are in more than one claim', async function () {
    if (federatedMode) this.skip()
    const author = await createHuman()
    const [ workA, workB ] = await Promise.all([
      createWorkWithAuthor(author),
      createWorkWithAuthor(author),
    ])
    const property = 'wdt:P50'
    const authorUri = workA.claims[property][0]
    await deleteByUris([ authorUri ])
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(403)
      err.body.status_verbose.should.equal('this entity is used has value in too many claims to be removed')
      const { uri, claims } = err.body.context
      uri.should.equal(author.uri)
      const claimA = claims.find(claim => claim.entity === workA.uri)
      const claimB = claims.find(claim => claim.entity === workB.uri)
      claimA.should.be.an.Object()
      claimA.property.should.equal(property)
      claimB.should.be.an.Object()
      claimB.property.should.equal(property)
    })
  })

  it('should remove edition entities without an ISBN', async function () {
    if (federatedMode) this.skip()
    const edition = await createEdition()
    const invUri: EntityUri = `inv:${edition._id}`
    await deleteByUris([ invUri ])
  })

  it('should remove edition entities with an ISBN from its inv uri', async function () {
    if (federatedMode) this.skip()
    const { invUri } = await createEditionWithIsbn()
    await deleteByUris([ invUri ])
  })

  it('should remove edition entities with an ISBN from its isbn uri', async function () {
    if (federatedMode) this.skip()
    const { uri } = await createEditionWithIsbn()
    await deleteByUris([ uri ])
  })

  it('should refuse to delete a work that is depend on by an edition', async function () {
    if (federatedMode) this.skip()
    const edition = await createEdition()
    const property = 'wdt:P629'
    const workUri = edition.claims[property][0]
    await deleteByUris([ workUri ])
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(403)
      err.body.status_verbose.should.equal('this entity is used in a critical claim')
      const { uri, claim } = err.body.context
      uri.should.equal(workUri)
      claim.should.deepEqual({ entity: edition.uri, property })
    })
  })

  it('should remove deleted entities from items snapshot', async function () {
    if (federatedMode) this.skip()
    const author = await createHuman()
    const work = await createWorkWithAuthor(author)
    const item = await authReq('post', '/api/items', { entity: work.uri })
    item.snapshot['entity:title'].should.equal(work.labels.en)
    item.snapshot['entity:authors'].should.equal(author.labels.en)
    await deleteByUris([ author.uri ])
    await wait(debounceDelay)
    const updatedItem = await getItemById(item._id)
    updatedItem.snapshot['entity:title'].should.equal(work.labels.en)
    should(updatedItem.snapshot['entity:authors']).not.be.ok()
  })

  it('should ignore entities that where already turned into removed:placeholder', async function () {
    if (federatedMode) this.skip()
    const { uri } = await createHuman()
    await deleteByUris([ uri ])
    const entity = await getByUri(uri) as SerializedInvEntity
    should(entity._meta_type).equal('removed:placeholder')
    await deleteByUris([ uri ])
  })

  it('should not deleted entities that are the entity of an item', async function () {
    if (federatedMode) this.skip()
    const work = await createWork()
    await authReq('post', '/api/items', { entity: work.uri })
    await deleteByUris([ work.uri ])
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("entities that are used by an item can't be removed")
      err.statusCode.should.equal(403)
    })
  })

  it('should not remove editions with an ISBN and an item', async function () {
    if (federatedMode) this.skip()
    const { invUri, uri } = await createEditionWithIsbn()
    await authReq('post', '/api/items', { entity: uri })
    // Using the inv URI, as the isbn one would be rejected
    await deleteByUris([ invUri ])
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("entities that are used by an item can't be removed")
      err.statusCode.should.equal(403)
    })
  })
})
