import should from 'should'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { createUser, getDeletedUser } from '#fixtures/users'
import { getDeanonymizedUser, publicReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

const { seed: seedUser } = hardCodedUsers

const endpoint = '/api/users?action=by-anonymizable-ids'

describe('users:by-anonymizable-ids', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: ids')
      err.statusCode.should.equal(400)
    }
  })

  it('should get an anonymized user without their public data', async () => {
    const user = await createUser()
    const { anonymizableId } = user
    const res = await publicReq('get', `${endpoint}&ids=${anonymizableId}`)
    const foundUser = res.users[anonymizableId]
    foundUser.should.deepEqual({
      anonymizableId,
      settings: {
        contributions: {
          anonymize: true,
        },
      },
    })
  })

  it('should get a deanonymized user public data', async () => {
    const user = await getDeanonymizedUser()
    const { anonymizableId } = user
    const res = await publicReq('get', `${endpoint}&ids=${anonymizableId}`)
    const foundUser = res.users[anonymizableId]
    foundUser.anonymizableId.should.equal(anonymizableId)
    foundUser.username.should.equal(user.username)
    should(foundUser.bio).equal(user.bio)
    foundUser.settings.should.deepEqual({
      contributions: {
        anonymize: false,
      },
    })
  })

  it('should get a special user flag', async () => {
    const { anonymizableId } = seedUser
    const res = await publicReq('get', `${endpoint}&ids=${anonymizableId}`)
    const foundUser = res.users[anonymizableId]
    foundUser.anonymizableId.should.equal(anonymizableId)
    foundUser.special.should.be.true()
  })

  it('should get a deleted user flag', async () => {
    const user = await getDeletedUser()
    const { anonymizableId } = user
    const res = await publicReq('get', `${endpoint}&ids=${anonymizableId}`)
    const foundUser = res.users[anonymizableId]
    foundUser.anonymizableId.should.equal(anonymizableId)
    foundUser.deleted.should.be.true()
  })
})
