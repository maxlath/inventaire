import 'should'
import { createWork } from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { customAuthReq } from '#tests/api/utils/request'
import {
  publicReq,
  authReq,
  adminReq,
  dataadminReq,
  getUserA,
  getUserB,
  getAdminUser,
  getDataadminUser,
} from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'
import type { RelativeUrl } from '#types/common'

describe('roles:public', () => {
  it('should not access an unauthorized endpoint', async () => {
    try {
      const endpoint = '/api/entities?action=create' as RelativeUrl
      await publicReq('post', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('unauthorized api access')
      err.statusCode.should.equal(401)
    }
  })

  it('should access public page', async () => {
    const res = await publicReq('get', '/api/config')
    res.should.be.ok()
  })
})

describe('roles:authentified', () => {
  it('should not access private resources from another user', async () => {
    try {
      const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
      const endpoint = `/api/entities?action=contributions&user=${userB._id}` as RelativeUrl
      await customAuthReq(userA, 'get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('non-public contributions')
      err.statusCode.should.equal(403)
    }
  })

  it('should access authentified page', async () => {
    const endpoint = '/api/user' as RelativeUrl
    const res = await authReq('get', endpoint)
    res.should.be.ok()
  })
})

describe('roles:admin', () => {
  it('should return a user with admin role', async function () {
    if (federatedMode) this.skip()
    const adminUser = await getAdminUser()
    adminUser.roles.should.deepEqual([ 'admin' ])
  })

  it('should access private resources from another user', async function () {
    if (federatedMode) this.skip()
    const user = await getUserB()
    const endpoint = `/api/entities?action=contributions&user=${user._id}` as RelativeUrl
    const res = await adminReq('get', endpoint)
    res.should.be.ok()
  })

  it('should merge entities', async function () {
    if (federatedMode) this.skip()
    const [ fromEntity, toEntity ] = await Promise.all([ createWork(), createWork() ])
    const res = await adminReq('put', '/api/entities?action=merge', { from: fromEntity.uri, to: toEntity.uri })
    res.ok.should.be.true()
  })
})

describe('roles:dataadmin', () => {
  it('should return a user with dataadmin role', async function () {
    if (federatedMode) this.skip()
    const dataadminUser = await getDataadminUser()
    dataadminUser.roles.should.deepEqual([ 'dataadmin' ])
  })

  it('should refuse access to private resources from another user', async function () {
    if (federatedMode) this.skip()
    try {
      const user = await getUserB()
      const endpoint = `/api/entities?action=contributions&user=${user._id}` as RelativeUrl
      await dataadminReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('non-public contributions')
      err.statusCode.should.equal(403)
    }
  })

  it('should merge entities', async function () {
    if (federatedMode) this.skip()
    const [ fromEntity, toEntity ] = await Promise.all([ createWork(), createWork() ])
    const res = await dataadminReq('put', '/api/entities?action=merge', { from: fromEntity.uri, to: toEntity.uri })
    res.ok.should.be.true()
  })
})
