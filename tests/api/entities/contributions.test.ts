import should from 'should'
import { createWork } from '#fixtures/entities'
import { someRandomCouchUuid } from '#fixtures/general'
import { createUser } from '#fixtures/users'
import { buildLocalUserAcct, getLocalUserAcct } from '#lib/federation/remote_user'
import { wait } from '#lib/promises'
import { federatedMode } from '#server/config'
import { updateClaim, updateLabel } from '#tests/api/utils/entities'
import { customAuthReq } from '#tests/api/utils/request'
import {
  adminReq,
  getUser,
  authReq,
  getDeanonymizedUser,
} from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const endpoint = '/api/entities?action=contributions'

describe('entities:contributions', () => {
  it('should return contributions from all users by default', async function () {
    if (federatedMode) this.skip()
    const user = await getUser()
    const { _id } = await createWork({ user })
    const { patches } = await adminReq('get', `${endpoint}&limit=5`)
    patches.should.be.an.Array()
    const lastPatch = patches[0]
    lastPatch._id.split(':')[0].should.equal(_id)
    const userAcct = await getLocalUserAcct(user)
    lastPatch.user.should.equal(userAcct)
  })

  it('should return an empty list of patch when user does not exist', async function () {
    if (federatedMode) this.skip()
    const id = someRandomCouchUuid()
    const { patches } = await adminReq('get', `${endpoint}&user=${buildLocalUserAcct(id)}`)
    patches.should.be.an.Array()
    patches.length.should.equal(0)
  })

  it('should return a list of patches', async function () {
    if (federatedMode) this.skip()
    const user = await getUser()
    const userAcct = await getLocalUserAcct(user)
    const { patches } = await adminReq('get', `${endpoint}&user=${userAcct}`)
    patches.should.be.an.Array()
  })

  it('should return a list of patches ordered by timestamp', async function () {
    if (federatedMode) this.skip()
    const { workA, workB, user } = await get2WorksAndUser()
    const userAcct = await getLocalUserAcct(user)
    const { patches } = await adminReq('get', `${endpoint}&user=${userAcct}`)
    const patchesIds = patches.map(getPatchEntityId)
    should(patchesIds.includes(workB._id)).be.true()
    should(patchesIds.includes(workA._id)).be.true()
    should(patches[0].timestamp > patches[1].timestamp).be.true()
  })

  it('should take a limit parameter', async function () {
    if (federatedMode) this.skip()
    const { workB, user } = await get2WorksAndUser()
    const userAcct = await getLocalUserAcct(user)
    const { patches } = await adminReq('get', `${endpoint}&user=${userAcct}&limit=1`)
    patches.length.should.equal(1)
    workB._id.should.equal(patches[0]._id.split(':')[0])
  })

  it('should take an offset parameter', async function () {
    if (federatedMode) this.skip()
    const { user } = await get2WorksAndUser()
    const userAcct = await getLocalUserAcct(user)
    const { patches } = await adminReq('get', `${endpoint}&user=${userAcct}`)
    const offset = 1
    const { patches: patches2 } = await adminReq('get', `${endpoint}&user=${userAcct}&offset=${offset}`)
    should(patches.length - offset).equal(patches2.length)
  })

  it('should return total data', async function () {
    if (federatedMode) this.skip()
    const { user } = await get2WorksAndUser()
    const userAcct = await getLocalUserAcct(user)
    const { total } = await adminReq('get', `${endpoint}&user=${userAcct}&limit=1`)
    total.should.be.a.Number()
    should(total >= 2).be.true()
  })

  it('should return continue data', async function () {
    if (federatedMode) this.skip()
    const { user } = await get2WorksAndUser()
    const userAcct = await getLocalUserAcct(user)
    const { continue: continu } = await adminReq('get', `${endpoint}&user=${userAcct}&limit=1`)
    continu.should.be.a.Number()
    continu.should.equal(1)
  })

  it('should return increment contributions', async function () {
    if (federatedMode) this.skip()
    const [ work, user ] = await Promise.all([ createWork(), getUser() ])
    const userAcct = await getLocalUserAcct(user)
    const { total } = await adminReq('get', `${endpoint}&user=${userAcct}`)
    should(total >= 1).be.true()
    const workB = await createWork()
    await wait(10)
    const { patches: patches2 } = await adminReq('get', `${endpoint}&user=${userAcct}`)
    getWorkId(patches2[0]._id).should.equal(workB._id)
    getWorkId(patches2[1]._id).should.equal(work._id)
  })

  describe('filter', () => {
    it('should filter by claim property', async function () {
      if (federatedMode) this.skip()
      const user = await createUser()
      const { uri } = await createWork({ user })
      const property = 'wdt:P921'
      await updateClaim({ uri, property, newValue: 'wd:Q1', user })
      await updateClaim({ uri, property: 'wdt:P136', newValue: 'wd:Q208505', user })
      await updateClaim({ uri, property, newValue: 'wd:Q3', user })
      await updateClaim({ uri, property, oldValue: 'wd:Q1', user })
      const userAcct = await getLocalUserAcct(user)
      const { patches, total } = await adminReq('get', `${endpoint}&user=${userAcct}&filter=${property}`)
      patches.length.should.equal(3)
      total.should.equal(3)
      patches.forEach(({ operations }) => {
        operations.some(operation => operation.path.includes(`/${property}`)).should.be.true()
      })
    })

    it('should filter by claim property in a multi-claim patch', async function () {
      if (federatedMode) this.skip()
      const user = await createUser()
      const property = 'wdt:P941'
      await createWork({
        user,
        claims: {
          'wdt:P921': [ 'wd:Q1' ],
          [property]: [ 'wd:Q180736' ],
          'wdt:P144': [ 'wd:Q180736' ],
        },
      })
      const userAcct = await getLocalUserAcct(user)
      const { patches } = await adminReq('get', `${endpoint}&user=${userAcct}&filter=${property}`)
      patches.length.should.be.aboveOrEqual(1)
      patches.forEach(({ operations }) => {
        operations.some(operation => operation.path.includes(`/${property}`)).should.be.true()
      })
    })

    it('should filter by label lang', async function () {
      if (federatedMode) this.skip()
      const user = await createUser()
      const { uri } = await createWork({ user })
      const lang = 'ca'
      await updateLabel({ uri, lang, value: 'foo', user })
      await updateLabel({ uri, lang: 'it', value: 'bar', user })
      await updateLabel({ uri, lang, value: 'buzz', user })
      const userAcct = await getLocalUserAcct(user)
      const { patches, total } = await adminReq('get', `${endpoint}&user=${userAcct}&filter=${lang}`)
      patches.length.should.equal(2)
      total.should.equal(2)
      patches.forEach(({ operations }) => {
        operations.some(operation => operation.path.includes(`/${lang}`)).should.be.true()
      })
    })
  })

  describe('non-admin access level', () => {
    it('should reject requests for private contributions from another user', async () => {
      const { user } = await get2WorksAndUser()
      const userAcct = await getLocalUserAcct(user)
      await authReq('get', `${endpoint}&user=${userAcct}`)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(403)
      })
    })

    it('should accept requests for private contributions from the user themselves', async () => {
      const { user } = await get2WorksAndUser()
      const userAcct = await getLocalUserAcct(user)
      const { patches } = await customAuthReq(user, 'get', `${endpoint}&user=${userAcct}`)
      patches.should.be.an.Array()
    })

    it('should accept requests for public contributions', async () => {
      const deanonymizedUser = await getDeanonymizedUser()
      const deanonymizedUserAcct = await getLocalUserAcct(deanonymizedUser)
      const { patches } = await authReq('get', `${endpoint}&user=${deanonymizedUserAcct}`)
      patches.should.be.an.Array()
    })

    it('should get anonymized contributions', async () => {
      const { workA, workB } = await get2WorksAndUser()
      const deanonymizedUser = await getDeanonymizedUser()
      const workC = await createWork({ user: deanonymizedUser })
      const { patches } = await authReq('get', endpoint)
      should(patches.find(isEntityPatch(workA)).user).not.be.ok()
      should(patches.find(isEntityPatch(workB)).user).not.be.ok()
      const patch = patches.find(isEntityPatch(workC))
      const deanonymizedUserAcct = await getLocalUserAcct(deanonymizedUser)
      patch.user.should.equal(deanonymizedUserAcct)
    })

    it('should not anonymize contributions when the patch author is the requesting user', async () => {
      const user = await createUser()
      const { _id: workId } = await createWork({ user })
      const { patches } = await customAuthReq(user, 'get', `${endpoint}&limit=1`)
      const userAcct = await getLocalUserAcct(user)
      patches[0]._id.should.startWith(workId)
      patches[0].user.should.equal(userAcct)
    })
  })
})

let worksAndUserPromise
const get2WorksAndUser = () => {
  worksAndUserPromise = worksAndUserPromise || create2WorksAndGetUser()
  return worksAndUserPromise
}

const create2WorksAndGetUser = async () => {
  // Use a reserved user to avoiding having contributions messed-up by tests
  // in other test files
  const user = await createUser()
  const workA = await createWork({ user })
  // Do not parallelize so that we can assume that workB creation is the last patch
  const workB = await createWork({ user })
  await wait(100)
  return { workA, workB, user }
}

const getWorkId = id => id.split(':')[0]
const getPatchEntityId = patch => patch._id.split(':')[0]
const isEntityPatch = entity => patch => patch._id.split(':')[0] === entity._id
