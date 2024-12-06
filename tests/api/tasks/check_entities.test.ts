import 'should'
import { map, uniq } from 'lodash-es'
import { createWorkWithAuthor, createHuman, createWork } from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { findOrIndexEntities, deleteByUris } from '#tests/api/utils/entities'
import { checkEntities, getBySuspectUri } from '#tests/api/utils/tasks'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { EntityUri } from '#types/entity'

describe('tasks:check-entities', () => {
  before(async () => {
    const wikidataUris: EntityUri[] = [ 'wd:Q237087' ]
    await findOrIndexEntities(wikidataUris)
  })

  it('should refuse to check entities of non-allowlisted types', async () => {
    // Currently, only humans can be checked for duplicates,
    // or at least are the entrypoint for duplicate checks
    const work = await createWork()
    await checkEntities(work.uri)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('unsupported type: work')
    })
  })

  it('should create tasks for the requested URIs', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman({ labels: { en: 'Fred Vargas' } })
    // should not automerge if author name is in work title
    await createWorkWithAuthor(human, 'Fred Vargas')
    const tasks = await checkEntities(human.uri)
    tasks.should.be.an.Array()
    const task = tasks[0]
    task.suspectUri.should.equal(human.uri)
    task.type.should.equal('deduplicate')
    task.entitiesType.should.equal(human.type)
    task.suggestionUri.should.startWith('wd')
    task.lexicalScore.should.be.a.Number()
    task.relationScore.should.be.a.Number()
    task.externalSourcesOccurrences.should.be.an.Array()
  })

  it('should not re-create existing tasks', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman({ labels: { en: 'Fred Vargas' } })
    await checkEntities(human.uri)
    await checkEntities(human.uri)
    const tasks = await getBySuspectUri(human.uri)
    const uniqSuggestiontUris = uniq(map(tasks, 'suggestionUri'))
    tasks.length.should.equal(uniqSuggestiontUris.length)
  })

  it('should not create a task for a removed placeholders', async function () {
    if (federatedMode) this.skip()
    const human = await createHuman({ labels: { en: 'Fred Vargas' } })
    await deleteByUris([ human.uri ])
    await checkEntities(human.uri)
    const tasks = await getBySuspectUri(human.uri)
    tasks.length.should.equal(0)
  })
})
