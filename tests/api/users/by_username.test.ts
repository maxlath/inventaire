import { map } from 'lodash-es'
import should from 'should'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { createUser, createUsername, getTwoFriends } from '#fixtures/users'
import { wait } from '#lib/promises'
import { toLowerCase } from '#lib/utils/base'
import { getRandomString } from '#lib/utils/random_string'
import { customAuthReq } from '#tests/api/utils/request'
import { deleteUser, updateUser } from '#tests/api/utils/users'
import {
  publicReq,
  authReq,
  getUser,
  getUserB,
  getDeanonymizedUser,
  adminReq,
} from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

const specialUsersNames = Object.keys(hardCodedUsers)

const endpoint = '/api/users?action=by-usernames'

describe('users:by-usernames', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: usernames')
      err.statusCode.should.equal(400)
    }
  })

  it('should get a user with a non lowercase username', async () => {
    let username = `notAllLowerCase${getRandomString(4)}`
    const lowerCasedUsername = username.toLowerCase()
    const user = await createUser({ username })
    await wait(10)
    username = user.username
    const res = await publicReq('get', `${endpoint}&usernames=${username}`)
    const { users } = res
    should(users[username]).not.be.ok()
    users[lowerCasedUsername].username.should.equal(username)
    users[lowerCasedUsername].snapshot.public.should.be.an.Object()
  })

  it('should get semi-private data if user is in network', async () => {
    const [ userA, userB ] = await getTwoFriends()
    const { username } = userA
    const lowerCasedUsername = username.toLowerCase()
    const { users } = await customAuthReq(userB, 'get', `${endpoint}&usernames=${username}`)
    users[lowerCasedUsername].should.be.an.Object()
    users[lowerCasedUsername].username.toLowerCase().should.equal(lowerCasedUsername)
    users[lowerCasedUsername].snapshot.public.should.be.an.Object()
    users[lowerCasedUsername].snapshot.network.should.be.an.Object()
  })

  it('should get private data if requested user is requester', async () => {
    const user = await getUser()
    const { username } = user
    const lowerCasedUsername = username.toLowerCase()
    const { users } = await authReq('get', `${endpoint}&usernames=${username}`)
    users[lowerCasedUsername].should.be.an.Object()
    users[lowerCasedUsername].snapshot.public.should.be.an.Object()
    users[lowerCasedUsername].snapshot.network.should.be.an.Object()
    users[lowerCasedUsername].snapshot.private.should.be.an.Object()
  })

  it('should get several users', async () => {
    const users = await Promise.all([ getUser(), getUserB() ])
    const usernames = map(users, 'username')
    const res = await publicReq('get', `${endpoint}&usernames=${usernames.join('|')}`)
    const lowercasedUsernames = usernames.map(toLowerCase)
    Object.keys(res.users).should.deepEqual(lowercasedUsernames)
  })

  it('should get a special user', async () => {
    const res = await publicReq('get', `${endpoint}&usernames=${specialUsersNames.join('|')}`)
    Object.keys(res.users).should.deepEqual(specialUsersNames)
  })

  it('should get a deleted user', async () => {
    const user = await createUser()
    await deleteUser(user)
    const res = await publicReq('get', `${endpoint}&usernames=${user.username}`)
    res.users[user.username.toLowerCase()].should.be.ok()
  })

  it('should get a user by both their stableUsername and current username', async () => {
    const initialUsername = createUsername()
    const newUsername = createUsername()
    // Make fediversable to set a stableUsername
    const user = await createUser({ fediversable: true, username: initialUsername })
    await updateUser({ user, attribute: 'username', value: newUsername })
    const res1 = await publicReq('get', `${endpoint}&usernames=${initialUsername}`)
    res1.users[initialUsername.toLowerCase()].should.be.ok()
    const res2 = await publicReq('get', `${endpoint}&usernames=${newUsername}`)
    res2.users[newUsername.toLowerCase()].should.be.ok()
  })

  describe('anonymizable id', () => {
    it('should not get the anonymizableId of an anonymized user', async () => {
      const user = await createUser()
      const { username } = user
      const { users } = await authReq('get', `${endpoint}&usernames=${username}`)
      const lowerCasedUsername = username.toLowerCase()
      should(users[lowerCasedUsername].anonymizableId).not.be.ok()
    })

    it('should get the anonymizableId of an anonymized user, when requested by the user', async () => {
      const user = await createUser()
      const { username } = user
      const { users } = await customAuthReq(user, 'get', `${endpoint}&usernames=${username}`)
      const lowerCasedUsername = username.toLowerCase()
      users[lowerCasedUsername].anonymizableId.should.be.a.String()
    })

    it('should get the anonymizableId of a deanonymized user', async () => {
      const user = await getDeanonymizedUser()
      const { username } = user
      const { users } = await publicReq('get', `${endpoint}&usernames=${username}`)
      const lowerCasedUsername = username.toLowerCase()
      users[lowerCasedUsername].anonymizableId.should.be.a.String()
    })

    it('should get the anonymizableId of an anonymized user, when requested as admin', async () => {
      const user = await createUser()
      const { username } = user
      const { users } = await adminReq('get', `${endpoint}&usernames=${username}`)
      const lowerCasedUsername = username.toLowerCase()
      users[lowerCasedUsername].anonymizableId.should.be.a.String()
    })
  })
})
