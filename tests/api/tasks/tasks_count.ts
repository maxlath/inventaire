import 'should'
import { createTask } from '#fixtures/tasks'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { tasksCount } from '#tests/api/utils/tasks'

describe('tasks:count', () => {
  it('should return tasks count per type', async () => {
    await createTask({
      type: 'deduplicate',
      entitiesType: 'human',
      reporter: getLocalUserAcct('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    })
    const count = await tasksCount()
    count.deduplicate.human.should.be.aboveOrEqual(1)
  })
})
