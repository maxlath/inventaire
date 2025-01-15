import 'should'
import { createTask } from '#fixtures/tasks'
import { federatedMode } from '#server/config'
import { getByScore } from '#tests/api/utils/tasks'

// Tests dependency: having a populated Elasticsearch wikidata index
describe('tasks:byScore', () => {
  it('should return 10 or less tasks by default', async function () {
    // Disabled in federated mode as this test directly mutates the local tasks database
    if (federatedMode) this.skip()
    await createTask()
    const tasks = await getByScore({})
    tasks.length.should.be.belowOrEqual(10)
    tasks.length.should.be.aboveOrEqual(1)
  })

  it('should return a limited array of tasks', async function () {
    // Disabled in federated mode as this test directly mutates the local tasks database
    if (federatedMode) this.skip()
    await createTask()
    const tasks = await getByScore({ limit: 1 })
    tasks.length.should.equal(1)
  })

  it('should take an offset parameter', async function () {
    // Disabled in federated mode as this test directly mutates the local tasks database
    if (federatedMode) this.skip()
    await createTask()
    const tasksA = await getByScore({})
    const tasksB = await getByScore({ offset: 1 })
    tasksA[1].should.deepEqual(tasksB[0])
  })
})
