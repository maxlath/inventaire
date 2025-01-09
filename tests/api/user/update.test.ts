import { get } from 'lodash-es'
import should from 'should'
import { indexesNamesByBaseNames } from '#db/elasticsearch/indexes'
import { getRefreshedUser, createUser, createUsername } from '#fixtures/users'
import { getRandomString } from '#lib/utils/random_string'
import { getToken } from '#tests/api/utils/oauth'
import { customAuthReq, bearerTokenReq } from '#tests/api/utils/request'
import { getIndexedDoc, waitForIndexation, waitForReindexation } from '#tests/api/utils/search'
import { getUser, getUserB } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const { users: usersIndex } = indexesNamesByBaseNames
const endpoint = '/api/user'

describe('user:update', () => {
  it('should update a user', async () => {
    const user = await createUser()
    const attribute = 'username'
    const value = getRandomString(6)
    await customAuthReq(user, 'put', endpoint, { attribute, value })
    const updatedUser = await getRefreshedUser(user)
    updatedUser[attribute].should.equal(value)
  })

  describe('position', () => {
    const attribute = 'position'
    const value = [ 10, 10 ]

    it('should update the position', async () => {
      const user = await createUser()
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      const updatedUser = await getRefreshedUser(user)
      updatedUser[attribute].should.deepEqual(value)
    })

    it('should round the coordinates', async () => {
      const user = await createUser()
      await customAuthReq(user, 'put', endpoint, { attribute, value: [ 10.123456, 10.123456 ] })
      const updatedUser = await getRefreshedUser(user)
      updatedUser[attribute].should.deepEqual([ 10.12346, 10.12346 ])
    })

    it('should allow to delete the position by passing null', async () => {
      const user = await createUser()
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      const updatedUser = await getRefreshedUser(user)
      updatedUser[attribute].should.deepEqual(value)
      await customAuthReq(user, 'put', endpoint, { attribute, value: null })
      const reupdatedUser = await getRefreshedUser(user)
      should(reupdatedUser[attribute]).not.be.ok()
    })

    it('should update the position index', async () => {
      const user = await createUser()
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      await waitForIndexation('users', user._id)
      const res = await getIndexedDoc(usersIndex, user._id)
      res._source.position.lat.should.equal(10)
      res._source.position.lon.should.equal(10)
      await customAuthReq(user, 'put', endpoint, { attribute, value: null })
      await waitForReindexation(res)
      const updatedResult = await getIndexedDoc(usersIndex, user._id)
      should(updatedResult._source.position).not.be.ok()
    })
  })

  describe('username', () => {
    it('should reject an update to an existing username', async () => {
      const [ userA, userB ] = await Promise.all([ getUser(), getUserB() ])
      await customAuthReq(userA, 'put', endpoint, {
        attribute: 'username',
        value: userB.username.toUpperCase(),
      })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('this username is already used')
      })
    })

    it('should accept unicode usernames', async () => {
      const username = createUsername()
      const user = await createUser({ username })
      await customAuthReq(user, 'put', endpoint, {
        attribute: 'username',
        value: username + 'éäàĝ',
      })
    })

    it('should reject an update to an existing unicode username', async () => {
      const usernameBase = createUsername()
      const nonNormalizedUnicodeLetter = '\u0065\u0301'
      const nonNormalizedUnicodeUsername = usernameBase + nonNormalizedUnicodeLetter
      const normalizedUnicodeUsername = nonNormalizedUnicodeUsername.normalize()
      const [ userA ] = await Promise.all([
        getUser(),
        createUser({ username: normalizedUnicodeUsername }),
      ])
      await customAuthReq(userA, 'put', endpoint, {
        attribute: 'username',
        value: nonNormalizedUnicodeUsername,
      })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('this username is already used')
      })
    })

    it('should reject an update to an existing stableUsername', async () => {
      const userA = await getUser()
      const userB = await createUser()
      const initialUsername = userB.username
      const token = await getToken({ user: userB, scope: [ 'stable-username' ] })
      // Trigger the creation of a stableUsername
      await bearerTokenReq(token, 'get', '/api/user')
      await customAuthReq(userB, 'put', endpoint, {
        attribute: 'username',
        value: initialUsername + 'a',
      })
      await customAuthReq(userA, 'put', endpoint, {
        attribute: 'username',
        value: initialUsername,
      })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('this username is already used')
      })
    })
  })

  describe('settings', () => {
    it('should update a setting', async () => {
      const user = await createUser()
      const attribute = 'settings.notifications.global'
      await customAuthReq(user, 'put', endpoint, { attribute, value: false })
      const updatedUser = await getRefreshedUser(user)
      get(updatedUser, attribute).should.be.false()
    })

    it('should update anonymize setting', async () => {
      const user = await createUser()
      const attribute = 'settings.contributions.anonymize'
      await customAuthReq(user, 'put', endpoint, { attribute, value: false })
      const updatedUser = await getRefreshedUser(user)
      get(updatedUser, attribute).should.be.false()
    })
  })

  describe('fediversable', () => {
    it('should update a user', async () => {
      const user = await createUser()
      const attribute = 'fediversable'
      const value = true
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      const updatedUser = await getRefreshedUser(user)
      updatedUser[attribute].should.equal(value)
      // relations on fediverse must rely on stable uris
      // therefore fediversable user shall have a stable username
      updatedUser.stableUsername.should.equal(user.username)
    })

    it('should update a user poolActivities setting', async () => {
      const user = await createUser()
      const attribute = 'poolActivities'
      const value = true
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      const updatedUser = await getRefreshedUser(user)
      updatedUser.poolActivities.should.equal(value)
    })
  })

  describe('custom properties', () => {
    it('should update custom properties', async () => {
      const user = await createUser()
      const attribute = 'customProperties'
      const value = [ 'wdt:P268' ]
      await customAuthReq(user, 'put', endpoint, { attribute, value })
      const updatedUser = await getRefreshedUser(user)
      updatedUser[attribute].should.deepEqual(value)
    })
  })
})
