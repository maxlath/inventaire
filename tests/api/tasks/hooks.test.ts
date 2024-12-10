import should from 'should'
import { createHuman } from '#fixtures/entities'
import { createTask } from '#fixtures/tasks'
import { wait } from '#lib/promises'
import { federatedMode } from '#server/config'
import { merge, revertMerge, deleteByUris as deleteEntityByUris, findOrIndexEntities } from '#tests/api/utils/entities'
import { getByIds, getBySuspectUri, update } from '#tests/api/utils/tasks'
import type { EntityUri } from '#types/entity'

const hookDelay = 300

describe('tasks:hooks', () => {
  describe('entity merge', () => {
    before(async () => {
      // Tests dependency: having a populated ElasticSearch wikidata index
      const wikidataUris: EntityUri[] = [
        'wd:Q535', 'wd:Q15339037', // some Victor Hugos
        'wd:Q237087', // Fred Vargas
      ]
      await findOrIndexEntities(wikidataUris)
    })

    it('should update same suspect tasks to processed state ', async function () {
      if (federatedMode) this.skip()
      const { uri: suspectUri } = await createHuman({ labels: { en: 'Victor Hugo' } })
      await createTask({
        suspectUri,
        suggestionUri: 'wd:Q535',
      })
      const otherTask = await createTask({
        suspectUri,
        suggestionUri: 'wd:Q15339037',
      })
      await merge(suspectUri, 'wd:Q535')
      await wait(hookDelay)
      const [ updatedTask ] = await getByIds(otherTask._id)
      updatedTask.state.should.equal('processed')
    })

    it('should update task state to processed', async function () {
      if (federatedMode) this.skip()
      const [ suspect, suggestion ] = await Promise.all([ createHuman(), createHuman() ])
      const taskParams = {
        suspectUri: suspect.uri,
        suggestionUri: suggestion.uri,
      }
      const task = await createTask(taskParams)
      await merge(suspect.uri, suggestion.uri)
      await wait(hookDelay)
      const [ updatedTask ] = await getByIds(task._id)
      updatedTask.state.should.equal('processed')
    })
  })

  describe('task update', () => {
    it('should update relationScore of tasks with same suspect', async function () {
      // Disabled in federated mode as this test directly mutates the local tasks database
      if (federatedMode) this.skip()
      const { uri: suspectUri } = await createHuman({ labels: { en: 'Victor Hugo' } })
      const taskToUpdate = await createTask({
        suspectUri,
        suggestionUri: 'wd:Q535',
      })
      const { _id: otherTaskId } = await createTask({
        suspectUri,
        suggestionUri: 'wd:Q15339037',
      })
      const [ otherTask ] = await getByIds(otherTaskId)
      const { relationScore: otherTaskRelationScore } = otherTask
      await update(taskToUpdate._id, 'state', 'dismissed')
      await wait(hookDelay)
      const [ updatedTask ] = await getByIds(otherTask._id)
      updatedTask.relationScore.should.not.equal(otherTaskRelationScore)
    })
  })

  describe('entity merge revert', () => {
    it('should revert task state', async function () {
      // Disabled in federated mode as this test directly mutates the local tasks database
      if (federatedMode) this.skip()
      const { uri } = await createHuman({ labels: { en: 'Fred Vargas' } })
      const { _id: otherTaskId } = await createTask({
        suspectUri: uri,
        suggestionUri: 'wd:Q15339037',
      })
      const [ task ] = await getByIds(otherTaskId)
      await merge(task.suspectUri, task.suggestionUri)
      await wait(hookDelay)
      const [ refreshedTask ] = await getByIds(task._id)
      refreshedTask.state.should.equal('processed')
      await revertMerge(refreshedTask.suspectUri)
      await wait(150)
      const [ rerefreshedTask ] = await getByIds(task._id)
      should(rerefreshedTask.state).not.be.ok()
    })
  })

  describe('entity removed', () => {
    it('should update tasks to processed state when the entity is deleted', async function () {
      if (federatedMode) this.skip()
      const suspect = await createHuman()
      await createTask({ suspectUri: suspect.uri })
      await deleteEntityByUris([ suspect.uri ])
      const tasks = await getBySuspectUri(suspect.uri)
      tasks.length.should.equal(0)
    })
  })
})
