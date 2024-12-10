import 'should'
import { createTask } from '#fixtures/tasks'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { federatedMode } from '#server/config'
import { tasksCount } from '#tests/api/utils/tasks'

describe('tasks:count', () => {
  it('should return tasks count per type', async function () {
    // Disabled in federated mode as this test directly mutates the local tasks database
    if (federatedMode) this.skip()
    await createTask({
      type: 'deduplicate',
      entitiesType: 'human',
      reporter: getLocalUserAcct('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    })
    const count = await tasksCount()
    count.deduplicate.human.should.be.aboveOrEqual(1)
  })
})
