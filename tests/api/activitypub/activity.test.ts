import 'should'
import { getEntityActorName, makeUrl } from '#controllers/activitypub/lib/helpers'
import { createWork, createHuman, addAuthor } from '#fixtures/entities'
import { createItem } from '#fixtures/items'
import { createShelfWithItem } from '#fixtures/shelves'
import { createUser } from '#fixtures/users'
import { wait } from '#lib/promises'
import config, { federatedMode } from '#server/config'
import { getActorName } from '#tests/api/utils/shelves'
import { publicReq, getFediversableUser } from '#tests/api/utils/utils'

const debounceTime = config.activitypub.activitiesDebounceTime + 50

describe('activity', () => {
  describe('users', () => {
    it('should get an activity', async () => {
      const user = await createUser({ fediversable: true })
      const { username } = user
      await createItem(user)
      await wait(debounceTime)
      const outboxUrl = makeUrl({ params: { action: 'outbox', name: username, offset: 0 } })
      const { orderedItems } = await publicReq('get', outboxUrl)
      const activityUrl = orderedItems[0].object.id
      const activityId = new URL(activityUrl).searchParams.get('id')
      const activity = await publicReq('get', `/api/activitypub?action=activity&id=${activityId}`)
      activity.id.should.equal(`${activityUrl}#create`)
      activity.type.should.equal('Create')
      activity.object.id.should.equal(activityUrl)
      activity.object.type.should.equal('Note')
      activity.object.content.should.be.a.String()
    })
  })

  describe('entities', () => {
    it('should get an activity', async function () {
      if (federatedMode) this.skip()
      const { uri: authorUri } = await createHuman()
      const { uri: workUri } = await createWork()
      await addAuthor(workUri, authorUri)
      const actorName = getEntityActorName(authorUri)
      const outboxUrl = makeUrl({ params: { action: 'outbox', name: actorName, offset: 0 } })
      const { orderedItems } = await publicReq('get', outboxUrl)
      const activityUrl = orderedItems[0].object.id
      const activity = await publicReq('get', activityUrl)
      activity.id.should.equal(`${activityUrl}#create`)
      activity.type.should.equal('Create')
      activity.object.id.should.equal(activityUrl)
      activity.object.type.should.equal('Note')
      activity.object.content.should.be.a.String()
    })
  })

  describe('shelf', () => {
    it('should get an activity', async () => {
      const { shelf } = await createShelfWithItem({}, null, getFediversableUser())
      const name = getActorName(shelf)
      await wait(debounceTime)
      const outboxUrl = makeUrl({ params: { action: 'outbox', name, offset: 0 } })
      const { orderedItems } = await publicReq('get', outboxUrl)
      const activityUrl = orderedItems[0].object.id
      const activityId = new URL(activityUrl).searchParams.get('id')
      const activity = await publicReq('get', `/api/activitypub?action=activity&id=${activityId}`)
      activity.id.should.equal(`${activityUrl}#create`)
      activity.type.should.equal('Create')
      activity.object.id.should.equal(activityUrl)
      activity.object.type.should.equal('Note')
      activity.object.content.should.be.a.String()
    })
  })
})
