import 'should'
import { getSomeWdEditionUri, someImageHash } from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { addClaim, getByUri, removeClaim } from '#tests/api/utils/entities'
import { getAdminUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

describe('entities type lock', () => {
  it('should reject non-dataadmin edits', async () => {
    const uri = await getSomeWdEditionUri()
    await addClaim({ uri, property: 'invp:P3', value: 'work' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(403)
      err.body.status_verbose.should.equal("editing property requires admin's rights")
    })
  })

  // Creating and updating local layers goes through different functions
  it('should reject non-dataadmin edits on an entity that already has a local layer', async () => {
    const uri = await getSomeWdEditionUri()
    await addClaim({ uri, property: 'invp:P2', value: someImageHash })
    await addClaim({ uri, property: 'invp:P3', value: 'work' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(403)
      err.body.status_verbose.should.equal("editing property requires admin's rights")
    })
  })

  it('should reject invalid types', async function () {
    if (federatedMode) this.skip()
    const uri = await getSomeWdEditionUri()
    const entity = await getByUri(uri)
    entity.type.should.equal('edition')
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'foo' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value')
    })
  })

  it('should type-lock an entity', async function () {
    if (federatedMode) this.skip()
    const uri = await getSomeWdEditionUri()
    const entity = await getByUri(uri)
    entity.type.should.equal('edition')
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    const updatedEntity = await getByUri(uri)
    updatedEntity.type.should.equal('work')
  })

  it('should type-lock an entity that already has a local layer', async function () {
    if (federatedMode) this.skip()
    const uri = await getSomeWdEditionUri()
    const entity = await getByUri(uri)
    entity.type.should.equal('edition')
    await addClaim({ uri, property: 'invp:P2', value: someImageHash })
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    const updatedEntity = await getByUri(uri)
    updatedEntity.type.should.equal('work')
  })

  it('should be possible to remove invp:P3 type lock', async function () {
    if (federatedMode) this.skip()
    const uri = await getSomeWdEditionUri()
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    await removeClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    const entity = await getByUri(uri)
    entity.type.should.equal('edition')
  })
})
