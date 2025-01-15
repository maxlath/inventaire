import { map } from 'lodash-es'
import should from 'should'
import { createUser, getTwoFriends } from '#fixtures/users'
import { customAuthReq } from '#tests/api/utils/request'
import { deleteUser } from '#tests/api/utils/users'
import { publicReq, authReq, getUser, getUserB, getDeanonymizedUser, adminReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

const endpoint = '/api/users?action=by-ids'

describe('users:by-ids', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: ids')
      err.statusCode.should.equal(400)
    }
  })

  it('should get a user public data', async () => {
    const user = await getUser()
    const userId = user._id
    const res = await publicReq('get', `${endpoint}&ids=${userId}`)
    res.users.should.be.an.Object()
    res.users[userId].should.be.an.Object()
    res.users[userId]._id.should.equal(userId)
    res.users[userId].snapshot.public.should.be.an.Object()
  })

  it('should get semi-private data if user is in network', async () => {
    const [ userA, userB ] = await getTwoFriends()
    const userAId = userA._id
    const { users } = await customAuthReq(userB, 'get', `${endpoint}&ids=${userAId}`)
    users[userAId].should.be.an.Object()
    users[userAId]._id.should.equal(userAId)
    users[userAId].snapshot.public.should.be.an.Object()
    users[userAId].snapshot.network.should.be.an.Object()
  })

  it('should get private data if requested user is requester', async () => {
    const user = await getUser()
    const userId = user._id
    const { users } = await authReq('get', `${endpoint}&ids=${userId}`)
    users[userId].should.be.an.Object()
    users[userId].snapshot.public.should.be.an.Object()
    users[userId].snapshot.network.should.be.an.Object()
    users[userId].snapshot.private.should.be.an.Object()
  })

  it('should get several users', async () => {
    const users = await Promise.all([ getUser(), getUserB() ])
    const ids = map(users, '_id')
    const res = await publicReq('get', `${endpoint}&ids=${ids.join('|')}`)
    Object.keys(res.users).should.deepEqual(ids)
  })

  it('should get deleted users', async () => {
    const user = await createUser()
    await deleteUser(user)
    const res = await publicReq('get', `${endpoint}&ids=${user._id}`)
    res.users[user._id].should.be.ok()
  })

  describe('anonymizable id', () => {
    it('should not get the anonymizableId of an anonymized user', async () => {
      const { _id: userId } = await createUser()
      const { users } = await authReq('get', `${endpoint}&ids=${userId}`)
      should(users[userId].anonymizableId).not.be.ok()
    })

    it('should get the anonymizableId of an anonymized user, when requested by the user', async () => {
      const user = await createUser()
      const { _id: userId } = user
      const { users } = await customAuthReq(user, 'get', `${endpoint}&ids=${userId}`)
      users[userId].anonymizableId.should.be.a.String()
    })

    it('should get the anonymizableId of a deanonymized user', async () => {
      const { _id: userId } = await getDeanonymizedUser()
      const { users } = await publicReq('get', `${endpoint}&ids=${userId}`)
      users[userId].anonymizableId.should.be.a.String()
    })

    it('should get the anonymizableId of an anonymized user, when requested as admin', async () => {
      const { _id: userId } = await createUser()
      const { users } = await adminReq('get', `${endpoint}&ids=${userId}`)
      users[userId].anonymizableId.should.be.a.String()
    })
  })
})
