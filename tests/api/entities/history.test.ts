import should from 'should'
import { createHuman, getSomeRemoteEditionWithALocalLayer } from '#fixtures/entities'
import { createUser } from '#fixtures/users'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { federatedMode } from '#server/config'
import { deleteByUris } from '#tests/api/utils/entities'
import { customAuthReq } from '#tests/api/utils/request'
import {
  adminReq,
  dataadminReq,
  publicReq,
  getDeanonymizedUser,
  authReqB,
} from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const endpoint = '/api/entities?action=history'

describe('entities:history', () => {
  it('should reject without an id or uri', async () => {
    await publicReq('get', endpoint)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('either a uri or an id is required')
    })
  })

  it('should throw when passed an invalid id', async () => {
    await publicReq('get', `${endpoint}&id=foo`)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.error_name.should.equal('invalid_id')
    })
  })

  it('should return entity patches', async () => {
    const human = await createHuman()
    const { patches } = await publicReq('get', `${endpoint}&id=${human._id}`)
    patches[0].snapshot.labels.should.deepEqual(human.labels)
  })

  it('should return removed placeholder patches', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman()
    await deleteByUris([ human.uri ])
    const { patches } = await publicReq('get', `${endpoint}&id=${human._id}`)
    patches[0].snapshot.labels.should.deepEqual(human.labels)
  })

  it('should not anonymize patches for admins', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman()
    const { patches } = await adminReq('get', `${endpoint}&id=${human._id}`)
    const patch = patches[0]
    patch.user.should.be.a.String()
  })

  it('should anonymize patches for dataadmins', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman()
    const { patches } = await dataadminReq('get', `${endpoint}&id=${human._id}`)
    const patch = patches[0]
    should(patch.user).not.be.ok()
  })

  it('should anonymize patches for authentified users', async () => {
    const human = await createHuman()
    const { patches } = await authReqB('get', `${endpoint}&id=${human._id}`)
    const patch = patches[0]
    should(patch.user).not.be.ok()
  })

  it('should anonymize patches for public users', async () => {
    const human = await createHuman()
    const { patches } = await publicReq('get', `${endpoint}&id=${human._id}`)
    const patch = patches[0]
    should(patch.user).not.be.ok()
  })

  it('should not anonymize patches from users that disabled anonymization', async () => {
    const [ user, human ] = await Promise.all([
      getDeanonymizedUser(),
      createHuman(),
    ])
    await customAuthReq(user, 'put', '/api/entities?action=update-label', {
      uri: human.uri,
      lang: 'es',
      value: 'foo',
    })
    const { patches } = await publicReq('get', `${endpoint}&id=${human._id}`)
    should(patches[0].user).not.be.ok()
    patches[1].user.should.equal(getLocalUserAcct(user._id))
  })

  it('should not anonymize patches when the author is the requesting user', async () => {
    const [ user, human ] = await Promise.all([
      createUser(),
      createHuman(),
    ])
    await customAuthReq(user, 'put', '/api/entities?action=update-label', {
      uri: human.uri,
      lang: 'es',
      value: 'foo',
    })
    const { patches } = await customAuthReq(user, 'get', `${endpoint}&id=${human._id}`)
    should(patches[0].user).not.be.ok()
    patches[1].user.should.equal(getLocalUserAcct(user._id))
  })

  it('should return local entity layer patches', async () => {
    const entity = await getSomeRemoteEditionWithALocalLayer()
    const { invId } = entity
    const { patches } = await publicReq('get', `${endpoint}&id=${invId}`)
    patches.length.should.equal(1)
    patches[0].snapshot.claims['invp:P1'].should.deepEqual(entity.claims['invp:P1'])
    patches[0].snapshot.claims['invp:P2'].should.deepEqual(entity.claims['invp:P2'])
  })

  it('should return local entity layer patches from wd uri', async () => {
    const entity = await getSomeRemoteEditionWithALocalLayer()
    const { patches } = await publicReq('get', `${endpoint}&uri=${entity.uri}`)
    patches.length.should.equal(1)
    patches[0].snapshot.claims['invp:P1'].should.deepEqual(entity.claims['invp:P1'])
    patches[0].snapshot.claims['invp:P2'].should.deepEqual(entity.claims['invp:P2'])
  })
})
