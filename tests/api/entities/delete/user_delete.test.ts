import should from 'should'
import { createHuman, createWork, createWorkWithAuthor, existsOrCreate } from '#fixtures/entities'
import { createTask } from '#fixtures/tasks'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { getByUris, deleteByUris } from '#tests/api/utils/entities'
import { getBySuspectUri } from '#tests/api/utils/tasks'
import { publicReq, getUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { SerializedInvEntity } from '#types/entity'

async function userDelete (uri) {
  return deleteByUris([ uri ], { user: getUser() })
}

async function getDeleteTaskBySuspectUri (uri) {
  return getBySuspectUri(uri, 'delete')
}

describe('entities:delete:as:user', () => {
  it('should reject not logged requests', async () => {
    await publicReq('post', '/api/entities?action=delete')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(401)
    })
  })

  it('should delete if the entity does not have any linked entity', async () => {
    const { uri } = await createHuman({
      claims: {
        'wdt:P569': [ '1900' ],
      },
    })
    await userDelete(uri)
    const { entities } = await getByUris([ uri ])
    const entity = entities[uri] as SerializedInvEntity
    entity._meta_type.should.equal('removed:placeholder')
  })

  it('should create a task if the entity has any linked entity', async () => {
    const { uri } = await createWorkWithAuthor()
    await userDelete(uri)
    const { entities } = await getByUris([ uri ])
    const entity = entities[uri] as SerializedInvEntity
    should(entity._meta_type).not.be.ok()
    const tasks = await getDeleteTaskBySuspectUri(uri)
    tasks.length.should.aboveOrEqual(1)
  })

  it('should create a task if entity has an external identifier property', async () => {
    const whateverOLId = 'OL11111W'
    const { uri } = await existsOrCreate({
      createFn: createWork,
      claims: {
        'wdt:P648': [ whateverOLId ],
      },
    })
    await userDelete(uri)
    const { entities } = await getByUris([ uri ])
    const entity = entities[uri] as SerializedInvEntity
    should(entity._meta_type).not.be.ok()
    const tasks = await getDeleteTaskBySuspectUri(uri)
    tasks.length.should.aboveOrEqual(1)
  })

  it('should update existing task and accept several reporters', async () => {
    const { uri } = await createWorkWithAuthor()
    const firstReporterId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    await createTask({
      type: 'delete',
      entitiesType: 'human',
      suspectUri: uri,
      reporter: getLocalUserAcct(firstReporterId),
    })

    await userDelete(uri)
    const tasksRes = await getDeleteTaskBySuspectUri(uri)
    tasksRes.length.should.equal(1)

    const user = await getUser()
    tasksRes[0].reporters.length.should.equal(2)
    tasksRes[0].reporters.should.deepEqual([ firstReporterId, user._id ])

    // should not create another task
    await userDelete(uri)
    const tasksRes2 = await getDeleteTaskBySuspectUri(uri)
    tasksRes2.length.should.equal(1)
    tasksRes2[0].reporters.length.should.equal(2)
  })
})
