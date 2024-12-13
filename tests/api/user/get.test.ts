import 'should'
import { createUser } from '#fixtures/users'
import { federatedMode } from '#server/config'
import { getToken } from '#tests/api/utils/oauth'
import { customAuthReq, bearerTokenReq } from '#tests/api/utils/request'
import { deleteUser, updateUser } from '#tests/api/utils/users'
import { getUser, dataadminReq, adminReq, authReq } from '#tests/api/utils/utils'

const endpoint = '/api/user'

describe('user:get', () => {
  it('should get user private data', async () => {
    const userPrivateData = await authReq('get', endpoint)
    userPrivateData._id.should.be.a.String()
    userPrivateData._rev.should.be.a.String()
    userPrivateData.username.should.be.a.String()
    userPrivateData.type.should.equal('user')
    userPrivateData.created.should.be.a.Number()
    userPrivateData.email.should.be.a.String()
    userPrivateData.validEmail.should.be.a.Boolean()
    userPrivateData.settings.should.be.an.Object()
    userPrivateData.settings.notifications.should.be.an.Object()
    userPrivateData.readToken.should.be.a.String()
    const { snapshot } = userPrivateData
    snapshot.private.should.be.an.Object()
    snapshot.network.should.be.an.Object()
    snapshot.public.should.be.an.Object()
    userPrivateData.enabledOAuth.should.be.an.Array()
  })

  it('should get delete user flag', async () => {
    const user = await createUser()
    await deleteUser(user)
    const deletedUserData = await customAuthReq(user, 'get', endpoint)
    deletedUserData._id.should.equal(user._id)
    deletedUserData.type.should.equal('deleted')
  })

  it('should get access levels', async () => {
    const userData = await authReq('get', endpoint)
    userData.roles.should.deepEqual([])
    userData.accessLevels.should.deepEqual([])
  })

  it('should get admin access levels', async function () {
    // Disabled in federated mode yet as this test relies on a special role
    if (federatedMode) this.skip()
    const userData = await adminReq('get', endpoint)
    const adminAccessLevels = [ 'public', 'authentified', 'dataadmin', 'admin' ]
    userData.accessLevels.should.deepEqual(adminAccessLevels)
  })

  it('should get dataadmin access levels', async function () {
    // Disabled in federated mode yet as this test relies on a special role
    if (federatedMode) this.skip()
    const userData = await dataadminReq('get', endpoint)
    const dataadminAccessLevels = [ 'public', 'authentified', 'dataadmin' ]
    userData.accessLevels.should.deepEqual(dataadminAccessLevels)
  })

  describe('scope-tailored user data', () => {
    it('should only return the attributes allowed for the authorized scopes', async () => {
      const token = await getToken({ scope: [ 'email', 'username' ] })
      const { body } = await bearerTokenReq(token, 'get', '/api/user')
      Object.keys(body).sort().should.deepEqual([ 'email', 'username' ])
    })
  })

  describe('stable username', () => {
    it('should always return the same username', async () => {
      const token = await getToken({ scope: [ 'username', 'stable-username' ] })
      const { body: userData } = await bearerTokenReq(token, 'get', '/api/user')
      const initialUsername = userData.username
      userData.stableUsername.should.equal(initialUsername)
      const updatedUsername = initialUsername + 'a'
      await updateUser({ user: getUser(), attribute: 'username', value: updatedUsername })
      const { body: userDataAfterUpdate } = await bearerTokenReq(token, 'get', '/api/user')
      userDataAfterUpdate.username.should.equal(updatedUsername)
      userDataAfterUpdate.stableUsername.should.equal(initialUsername)
    })
  })
})
