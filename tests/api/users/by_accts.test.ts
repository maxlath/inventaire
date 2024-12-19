import { pick } from 'lodash-es'
import { deanonymizedAttributes } from '#controllers/user/lib/anonymizable_user'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { createUser, getDeletedUser } from '#fixtures/users'
import { buildLocalUserAcct, getLocalUserAcct } from '#lib/federation/remote_user'
import { adminReq, getDeanonymizedUser, publicReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

const { seed: seedUser } = hardCodedUsers

const endpoint = '/api/users?action=by-accts'

describe('users:by-accts', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: accts')
      err.statusCode.should.equal(400)
    }
  })

  it('should get a local anonymized user', async () => {
    const user = await createUser()
    const acct = buildLocalUserAcct(user.anonymizableId)
    const res = await publicReq('get', `${endpoint}&accts=${acct}`)
    const foundUser = res.users[acct]
    foundUser.should.deepEqual({
      acct,
      roles: [],
      settings: {
        contributions: {
          anonymize: true,
        },
      },
    })
  })

  it('should get a local deanonymized user', async () => {
    const user = await getDeanonymizedUser()
    const acct = buildLocalUserAcct(user.anonymizableId)
    const res = await publicReq('get', `${endpoint}&accts=${acct}`)
    const foundUser = res.users[acct]
    foundUser.should.deepEqual({
      acct,
      roles: [],
      settings: {
        contributions: {
          anonymize: false,
        },
      },
      ...pick(user, deanonymizedAttributes),
    })
  })

  it('should get an admin view of a local anonymized user', async () => {
    const user = await createUser()
    const acct = buildLocalUserAcct(user.anonymizableId)
    const res = await adminReq('get', `${endpoint}&accts=${acct}`)
    const foundUser = res.users[acct]
    foundUser.should.deepEqual({
      acct,
      roles: [],
      settings: {
        contributions: {
          anonymize: true,
        },
      },
      ...pick(user, deanonymizedAttributes),
    })
  })

  it('should get a special user flag', async () => {
    const acct = getLocalUserAcct(seedUser)
    const res = await publicReq('get', `${endpoint}&accts=${acct}`)
    const foundUser = res.users[acct]
    foundUser.acct.should.equal(acct)
    foundUser.special.should.be.true()
  })

  it('should get a deleted user flag', async () => {
    const user = await getDeletedUser()
    const acct = getLocalUserAcct(user)
    const res = await publicReq('get', `${endpoint}&accts=${acct}`)
    const foundUser = res.users[acct]
    foundUser.acct.should.equal(acct)
    foundUser.deleted.should.be.true()
  })
})
