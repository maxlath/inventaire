import { createWork } from '#fixtures/entities'
import { createElement } from '#fixtures/listings'
import type { AwaitableUserWithCookie } from '#fixtures/users'
import { federatedMode } from '#server/config'
import { merge } from '#tests/api/utils/entities'
import { customAuthReq } from '#tests/api/utils/request'
import { getUser, getUserB, publicReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'
import type { RelativeUrl } from '#types/common'
import type { ListingElementId } from '#types/element'

const endpoint = '/api/lists?action=by-element-id'

interface GetListingByIdParams {
  user?: AwaitableUserWithCookie
  id: ListingElementId
}

export async function getElementById ({ user, id }: GetListingByIdParams) {
  user = user || getUser()
  const path: RelativeUrl = `${endpoint}&id=${id}`
  const { element } = await customAuthReq(user, 'get', path)
  return element
}

describe('listings:by-element-id', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: id')
      err.statusCode.should.equal(400)
    }
  })

  it('should reject non-existing element', async () => {
    try {
      await getElementById({ id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('not found')
      err.statusCode.should.equal(404)
    }
  })

  describe('visibility:overview', () => {
  // for detail visibility validations, see ./visibility.test.js
    it("should get a public listing's element", async () => {
      const { element: reqElement } = await createElement({})
      const element = await getElementById({ id: reqElement._id })
      element.should.be.an.Object()
    })

    it("should not return a private listing's element to an authentified user", async () => {
      const { element: reqElement } = await createElement({ visibility: [] })
      await getElementById({ id: reqElement._id, user: getUserB() })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(403)
      })
    })
  })

  describe('redirects hook', () => {
    it('should update element uri after merging entities', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const work = await createWork()
      const { uri, element: reqElement } = await createElement({})
      await merge(uri, work.uri)
      const element = await getElementById({ id: reqElement._id })
      element.uri.should.equal(work.uri)
    })
  })
})
