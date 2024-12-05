import { federatedMode } from '#server/config'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

describe('entities:federated mode', () => {
  it('should close endpoints not yet implemented in federated mode', async function () {
    if (!federatedMode) this.skip()
    await authReq('put', '/api/entities?action=revert-merge')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('This endpoint is closed in federated mode')
    })
  })
})
