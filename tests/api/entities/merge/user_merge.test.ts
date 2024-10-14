import { createTask } from '#fixtures/tasks'
import 'should'
import {
  createCollection,
  createEdition,
  createPublisher,
  randomLabel,
  createEditionWithIsbn,
  createHuman,
  createWorkWithAuthor,
  createWork,
  addPublisher,
} from '#tests/api/fixtures/entities'
import { getByUris, merge } from '#tests/api/utils/entities'
import { getBySuspectUri } from '#tests/api/utils/tasks'
import { publicReq, getUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

async function userMerge (fromUri, toUri) {
  return merge(fromUri, toUri, { user: getUser() })
}

describe('entities:merge:as:user', () => {
  it('should reject not logged requests', async () => {
    await publicReq('put', '/api/entities?action=merge')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(401)
    })
  })

  describe('authors', () => {
    it('should merge when works labels match', async () => {
      const humanLabel = randomLabel()
      const workLabel = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const human2 = await createHuman({ labels: { en: humanLabel } })
      await Promise.all([
        createWorkWithAuthor(human2, workLabel),
        createWorkWithAuthor(human, workLabel),
      ])

      await userMerge(human.uri, human2.uri)
      const { entities } = await getByUris(human.uri)
      entities[human2.uri].should.be.ok()
      const tasks = await getBySuspectUri(human.uri)
      tasks.length.should.equal(0)
    })

    it('should create a task when no works labels match', async () => {
      const humanLabel = randomLabel()
      const workLabel = randomLabel()
      const workLabel2 = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const human2 = await createHuman({ labels: { en: humanLabel } })
      await Promise.all([
        createWorkWithAuthor(human, workLabel),
        createWorkWithAuthor(human2, workLabel2),
      ])

      const res = await userMerge(human.uri, human2.uri)
      const tasks = await getBySuspectUri(human.uri)
      tasks.length.should.aboveOrEqual(1)
      const user = await getUser()
      const task = tasks[0]
      task.reporters.should.deepEqual([ user._id ])
      res.taskId.should.equal(task._id)
    })

    it('should update existing task and accept several reporters', async () => {
      const humanLabel = randomLabel()
      const workLabel = randomLabel()
      const workLabel2 = randomLabel()
      const workLabel3 = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const human2 = await createHuman({ labels: { en: humanLabel } })
      const human3 = await createHuman({ labels: { en: humanLabel } })
      await Promise.all([
        createWorkWithAuthor(human, workLabel),
        createWorkWithAuthor(human2, workLabel2),
        createWorkWithAuthor(human3, workLabel3),
      ])
      const firstReporterId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const task = await createTask({
        entitiesType: 'human',
        suspectUri: human.uri,
        suggestionUri: human2.uri,
        reporter: firstReporterId,
      })

      const res = await userMerge(human.uri, human2.uri)
      const tasks2 = await getBySuspectUri(human.uri)
      tasks2.length.should.equal(1)

      const user = await getUser()
      tasks2[0].reporters.length.should.equal(2)
      tasks2[0].reporters.should.deepEqual([ firstReporterId, user._id ])
      res.taskId.should.equal(task._id)

      // should not add an existing userId
      await userMerge(human.uri, human2.uri)
      const tasks3 = await getBySuspectUri(human.uri)
      tasks3.length.should.equal(1)
      tasks3[0].reporters.length.should.equal(2)
    })
  })

  describe('works', () => {
    it('should merge if authors labels match', async () => {
      const humanLabel = randomLabel()
      const workLabel = randomLabel()
      const workLabel2 = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const human2 = await createHuman({ labels: { en: humanLabel } })
      const [ work1, work2 ] = await Promise.all([
        createWorkWithAuthor(human2, workLabel),
        createWorkWithAuthor(human, workLabel2),
      ])

      await userMerge(work1.uri, work2.uri)
      const { entities } = await getByUris(work1.uri)
      should(entities[work2.uri]).be.ok()
    })

    it('should create a task when no authors labels match', async () => {
      const humanLabel = randomLabel()
      const humanLabel2 = randomLabel()
      const workLabel = randomLabel()
      const workLabel2 = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const human2 = await createHuman({ labels: { en: humanLabel2 } })
      const [ work1, work2 ] = await Promise.all([
        createWorkWithAuthor(human, workLabel),
        createWorkWithAuthor(human2, workLabel2),
      ])

      await userMerge(work1.uri, work2.uri)
      const tasks = await getBySuspectUri(work1.uri)
      tasks.length.should.aboveOrEqual(1)
    })

    it('should merge if authors have the same URI and works labels match', async () => {
      const humanLabel = randomLabel()
      const workLabel = randomLabel()
      const human = await createHuman({ labels: { en: humanLabel } })
      const [ work1, work2 ] = await Promise.all([
        createWorkWithAuthor(human, workLabel),
        createWorkWithAuthor(human, workLabel),
      ])

      await userMerge(work1.uri, work2.uri)
      const { entities } = await getByUris(work1.uri)
      should(entities[work2.uri]).be.ok()
    })
  })

  describe('publishers', () => {
    // Conservative path for this first implementation,
    // this may automerge later, if too many task happen to be created
    it('should create a task even if publishers labels match', async () => {
      const label = randomLabel()
      const [ edition, edition2, publisher1, publisher2 ] = await Promise.all([
        createEdition(),
        createEdition(),
        createPublisher({ labels: { en: label } }),
        createPublisher({ labels: { en: label } }),
      ])
      await addPublisher(edition, publisher1)
      await addPublisher(edition2, publisher2)

      await userMerge(publisher1.uri, publisher2.uri)
      const tasks = await getBySuspectUri(publisher1.uri)
      tasks.length.should.aboveOrEqual(1)
    })

    // This is likely to happen so rarely,
    // that implementing it does not seem worthy.
    xit('should merge if publishers have a publication in common but their labels do not match', async () => {
      const [ edition, publisher1, publisher2 ] = await Promise.all([
        createEdition(),
        createPublisher(),
        createPublisher(),
      ])
      await addPublisher(edition, publisher1)
      await addPublisher(edition, publisher2)

      await userMerge(publisher1.uri, publisher2.uri)
      const { entities } = await getByUris(publisher1.uri)
      should(entities[publisher2.uri]).be.ok()
    })

    // This requires to fetch every editions of the 2 publishers
    // which could be intensive (fetching the data but also comparing editions (ie. 2 publishers with 1000 editions each is on million comparisons)
    // It seems reasonnable to not merge if a publisher is already linked to the other (ie. one have bought the other)
    xit('should merge if publishers respectively have an edition which have an isbn prefix in common', async () => {
      const [ edition, edition2, publisher1, publisher2 ] = await Promise.all([
        createEditionWithIsbn(),
        createEditionWithIsbn(),
        createPublisher(),
        createPublisher(),
      ])
      edition.isbn.should.startWith(edition2.isbn.slice(0, 8))
      await addPublisher(edition, publisher1)
      await addPublisher(edition2, publisher2)

      await userMerge(publisher1.uri, publisher2.uri)
      const { entities } = await getByUris(publisher1.uri)
      should(entities[publisher2.uri]).be.ok()
    })
  })

  describe('collections', () => {
    it('should merge if publishers labels match', async () => {
      const label = randomLabel()
      const [ publisher1, publisher2 ] = await Promise.all([
        createPublisher({ labels: { en: label } }),
        createPublisher({ labels: { en: label } }),
      ])
      const [ collection1, collection2 ] = await Promise.all([
        createCollection({ claims: { 'wdt:P123': [ publisher1.uri ] } }),
        createCollection({ claims: { 'wdt:P123': [ publisher2.uri ] } }),
      ])

      await userMerge(collection1.uri, collection2.uri)
      const { entities } = await getByUris(collection1.uri)
      should(entities[collection2.uri]).be.ok()
    })

    it('should create a task when no publishers labels match', async () => {
      const label1 = randomLabel()
      const label2 = randomLabel()
      const [ publisher1, publisher2 ] = await Promise.all([
        createPublisher({ labels: { en: label1 } }),
        createPublisher({ labels: { en: label2 } }),
      ])
      const [ collection1, collection2 ] = await Promise.all([
        createCollection({ claims: { 'wdt:P123': [ publisher1.uri ] } }),
        createCollection({ claims: { 'wdt:P123': [ publisher2.uri ] } }),
      ])

      await userMerge(collection1.uri, collection2.uri)
      const tasks = await getBySuspectUri(collection1.uri)
      tasks.length.should.aboveOrEqual(1)
    })
  })

  describe('editions', () => {
    it('should merge if works labels match', async () => {
      const label = randomLabel()
      const [ work1, work2 ] = await Promise.all([
        createWork({ labels: { it: label } }),
        createWork({ labels: { it: label } }),
      ])

      const [ edition, edition2 ] = await Promise.all([
        createEdition({ work: work1 }),
        createEdition({ work: work2 }),
      ])

      await userMerge(edition.uri, edition2.uri)
      const { entities } = await getByUris(edition.uri)
      should(entities[edition2.uri]).be.ok()
    })

    it('should create a task when no work labels match', async () => {
      const [ edition, edition2 ] = await Promise.all([
        createEdition(),
        createEdition(),
      ])

      await userMerge(edition.uri, edition2.uri)
      const tasks = await getBySuspectUri(edition.uri)
      tasks.length.should.aboveOrEqual(1)
    })
  })
})
