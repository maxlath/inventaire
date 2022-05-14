const should = require('should')
const { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } = require('tests/api/utils/utils')
const { publicReq, customAuthReq, authReq, getUser, getUserB, getReservedUser } = require('../utils/utils')
const { createList } = require('../fixtures/lists')
const { createUser, getTwoFriends } = require('../fixtures/users')
const { createGroupWithAMember, getSomeGroupWithAMember } = require('tests/api/fixtures/groups')

const endpoint = '/api/lists?action=by-creators'

describe('lists:by-creators', () => {
  describe('visibility:public', () => {
    it('should reject without users', async () => {
      try {
        const res = await authReq('get', endpoint)
        shouldNotBeCalled(res)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.body.status_verbose.should.equal('missing parameter in query: users')
        err.statusCode.should.equal(400)
      }
    })

    it('should be empty without lists', async () => {
      const user = await getReservedUser()
      const { _id: userId } = user
      const res = await publicReq('get', `${endpoint}&users=${userId}`)
      res.lists.should.deepEqual({})
    })

    it('should get a public list', async () => {
      const { list } = await createList()
      list.visibility.should.deepEqual([ 'public' ])
      const res = await publicReq('get', `${endpoint}&users=${list.creator}`)
      res.lists[list._id].should.be.ok()
    })
  })

  describe('visibility:private', () => {
    it('should return user list', async () => {
      const { list } = await createList(null, { visibility: [] })
      const user = await getUser()
      const res = await authReq('get', `${endpoint}&users=${user._id}`)
      res.lists[list._id].should.be.ok()
    })

    it('should not return private lists', async () => {
      const { list } = await createList(getUserB(), { visibility: [] })
      const user = await getUserB()
      const res = await authReq('get', `${endpoint}&users=${user._id}`)
      should(res.lists[list._id]).not.be.ok()
    })

    it('should not return friends private lists', async () => {
      const [ userA, userB ] = await getTwoFriends()
      const { list } = await createList(userA, { visibility: [] })
      const res = await customAuthReq(userB, 'get', `${endpoint}&users=${userA._id}`)
      should(res.lists[list._id]).not.be.ok()
    })
  })

  describe('visibility:friends', () => {
    it('should return a friends-only list to a friend', async () => {
      const [ userA, userB ] = await getTwoFriends()
      const { list } = await createList(userA, { visibility: [ 'friends' ] })
      const res = await customAuthReq(userB, 'get', `${endpoint}&users=${userA._id}`)
      res.lists[list._id].should.be.ok()
    })

    it('should not return a friends-only list to a group co-member', async () => {
      const { member: memberA, admin: memberB } = await getSomeGroupWithAMember()
      const { list } = await createList(memberA, { visibility: [ 'friends' ] })
      const res = await customAuthReq(memberB, 'get', `${endpoint}&users=${memberA._id}`)
      should(res.lists[list._id]).not.be.ok()
    })
  })

  describe('visibility:groups', () => {
    it('should return a groups-only list to a group co-member', async () => {
      const { member: memberA, admin: memberB } = await getSomeGroupWithAMember()
      const { list } = await createList(memberA, { visibility: [ 'groups' ] })
      const res = await customAuthReq(memberB, 'get', `${endpoint}&users=${memberA._id}`)
      should(res.lists[list._id]).be.ok()
    })

    it('should not return a groups-only list to a friend', async () => {
      const [ userA, userB ] = await getTwoFriends()
      const { list } = await createList(userA, { visibility: [ 'groups' ] })
      const res = await customAuthReq(userB, 'get', `${endpoint}&users=${userA._id}`)
      should(res.lists[list._id]).not.be.ok()
    })
  })

  describe('visibility:group', () => {
    it('should not return a group-allowed list to a non-member', async () => {
      const user = await createUser()
      const { group, member } = await createGroupWithAMember()
      const { list } = await createList(member, { visibility: [ `group:${group._id}` ] })
      const res = await customAuthReq(user, 'get', `${endpoint}&users=${member._id}`)
      should(res.lists[list._id]).not.be.ok()
    })

    it('should return a group-allowed list to a member', async () => {
      const { group, member: memberA, admin: memberB } = await createGroupWithAMember()
      const { list } = await createList(memberA, { visibility: [ `group:${group._id}` ] })
      const res = await customAuthReq(memberB, 'get', `${endpoint}&users=${memberA._id}`)
      res.lists[list._id].should.be.ok()
    })
  })
})
