import 'should'
import { createHuman, someFakeUri } from '#fixtures/entities'
import { createTask } from '#fixtures/tasks'
import { federatedMode } from '#server/config'
import {
  endpoint,
  getBySuspectUris,
  getBySuggestionUris,
  update,
} from '#tests/api/utils/tasks'
import { publicReq } from '#tests/api/utils/utils'

describe('tasks:bySuspectUris', () => {
  it('should return an array of tasks', async function () {
    // Disabled in federated mode as the test relies on directly calling createTask
    // which operates on the local tasks database, and not on the remote one
    if (federatedMode) this.skip()
    const suspect = await createHuman()
    await createTask({ suspectUri: suspect.uri })
    const { uri } = suspect
    const tasks = await getBySuspectUris(uri)
    tasks.should.be.an.Object()
    Object.keys(tasks).length.should.equal(1)
    tasks[uri].should.be.an.Array()
    tasks[uri][0].should.be.an.Object()
  })

  it('should return an array of tasks when passed an empty type', async function () {
    // Disabled in federated mode as the test relies on directly calling createTask
    // which operates on the local tasks database, and not on the remote one
    if (federatedMode) this.skip()
    const suspect = await createHuman()
    await createTask({ suspectUri: suspect.uri })
    const { uri } = suspect
    const { tasks } = await publicReq('get', `${endpoint}by-uris&uris=${uri}`)
    tasks[uri][0].should.be.an.Object()
  })

  it('should not return archived tasks', async function () {
    // Disabled in federated mode as the test relies on directly calling createTask
    // which operates on the local tasks database, and not on the remote one
    if (federatedMode) this.skip()
    const suspect = await createHuman()
    const { uri } = suspect
    const task = await createTask({ suspectUri: uri })
    await update(task._id, 'state', 'dismissed')
    const tasks = await getBySuspectUris(uri)
    tasks[uri].length.should.equal(0)
  })

  it('should return an array of tasks even when no tasks is found', async () => {
    const tasks = await getBySuspectUris(someFakeUri)
    tasks.should.be.an.Object()
    Object.keys(tasks).length.should.equal(1)
    tasks[someFakeUri].should.be.an.Array()
    tasks[someFakeUri].length.should.equal(0)
  })
})

describe('tasks:bySuggestionUris', () => {
  it('should return tasks', async function () {
    // Disabled in federated mode as the test relies on directly calling createTask
    // which operates on the local tasks database, and not on the remote one
    if (federatedMode) this.skip()
    const suggestion = await createHuman()
    const { uri } = suggestion
    await createTask({ suggestionUri: uri })
    const tasks = await getBySuggestionUris(uri)
    tasks.should.be.an.Object()
    Object.keys(tasks).length.should.equal(1)
    tasks[uri].should.be.an.Array()
    tasks[uri][0].should.be.an.Object()
  })

  it('should return an array of tasks even when no tasks is found', async () => {
    const uri = 'wd:Q32193244'
    const tasks = await getBySuggestionUris(uri)
    tasks.should.be.an.Object()
    Object.keys(tasks).length.should.equal(1)
    tasks[uri].should.be.an.Array()
    tasks[uri].length.should.equal(0)
  })
})
