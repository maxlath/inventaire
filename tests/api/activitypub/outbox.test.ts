import 'should'
import { getEntityActorName, makeUrl } from '#controllers/activitypub/lib/helpers'
import { createWork, createHuman, addAuthor } from '#fixtures/entities'
import { createItem, createItems } from '#fixtures/items'
import { createShelf, createShelfWithItem } from '#fixtures/shelves'
import { createUser } from '#fixtures/users'
import { wait } from '#lib/promises'
import config, { federatedMode } from '#server/config'
import { updateItems } from '#tests/api/utils/items'
import { customAuthReq } from '#tests/api/utils/request'
import { getActorName } from '#tests/api/utils/shelves'
import { publicReq, getFediversableUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'
import type { Url } from '#types/common'

const origin = config.getPublicOrigin()
const debounceTime = config.activitypub.activitiesDebounceTime + 50
const endpoint = '/api/activitypub?action=outbox&name='

describe('outbox', () => {
  describe('users', () => {
    it('reject if user is not fediversable', async () => {
      try {
        const user = createUser({ fediversable: false })
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}`
        await publicReq('get', outboxUrl).then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
        err.body.status_verbose.should.equal('user is not on the fediverse')
      }
    })

    it('should return a first page URL', async () => {
      const user = createUser({ fediversable: true })
      await createItem(user)
      const { username } = await user
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${username}`
      const res = await publicReq('get', outboxUrl)
      const url = `${origin}${outboxUrl}`
      res.id.should.equal(url)
      res.type.should.equal('OrderedCollection')
      res.totalItems.should.equal(1)
      res.first.should.equal(`${url}&offset=0`)
    })

    it('should paginate activities', async () => {
      const user = createUser({ fediversable: true })
      const itemA = await createItem(user, { visibility: [ 'public' ] })
      await wait(debounceTime)
      const itemB = await createItem(user, { visibility: [ 'public' ] })
      await wait(debounceTime)
      const { username } = await user
      const firstOutboxPage: Url = `${endpoint}${username}&offset=0&limit=1`
      const res1 = await publicReq('get', firstOutboxPage)
      res1.orderedItems.length.should.equal(1)
      res1.orderedItems[0].object.content.should.containEql(itemB._id)
      const nextOutboxPage: Url = `${endpoint}${username}&offset=1&limit=1`
      const res2 = await publicReq('get', nextOutboxPage)
      res2.orderedItems.length.should.equal(1)
      res2.orderedItems[0].object.content.should.containEql(itemA._id)
    })

    it('should return content with items link', async () => {
      const user = createUser({ fediversable: true, language: 'it' })
      const details = 'details'
      const item = await createItem(user, { details })
      const { username } = await user
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${username}&offset=0`
      const url = `${origin}${endpoint}${username}`
      const res = await publicReq('get', outboxUrl)
      res.type.should.equal('OrderedCollectionPage')
      res.partOf.should.equal(url)
      res.first.should.equal(`${url}&offset=0`)
      res.next.should.equal(`${url}&offset=10`)
      res.orderedItems.should.be.an.Array()
      res.orderedItems.length.should.equal(1)
      const createActivity = res.orderedItems[0]
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const activityEndpoint = makeUrl({ params: { action: 'activity' } })
      createActivity.id.should.startWith(activityEndpoint)
      createActivity.actor.should.equal(actorUrl)
      createActivity.object.content.should.containEql(item._id)
      createActivity.object.content.should.containEql(details)
      createActivity.to.should.containEql('Public')
      createActivity.object.attachment.should.be.an.Array()
    })

    it('should return clean content when no item details', async () => {
      const user = createUser({ fediversable: true })
      await createItem(user)
      const { username } = await user
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${username}&offset=0`
      const res = await publicReq('get', outboxUrl)
      res.orderedItems[0].object.content.should.not.containEql('undefined')
    })

    it('should not return network items', async () => {
      const user = createUser({ fediversable: true })
      await createItem(user, { visibility: [ 'friends', 'groups' ] })
      const { username } = await user
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${username}&offset=0`
      const res = await publicReq('get', outboxUrl)
      res.orderedItems.length.should.equal(0)
    })

    describe('update:items', () => {
      it('should not create an activity if another activity already has item id', async () => {
        // meaning updating any item attribute wont trigger any activity
        const user = createUser({ fediversable: true })
        const item = await createItem(user)
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        await wait(debounceTime)
        item.transaction = 'lending'
        await customAuthReq(user, 'put', '/api/items', item)
        await wait(debounceTime)
        const res = await publicReq('get', outboxUrl)
        res.orderedItems.length.should.equal(1)
      })

      it('should including an item previously private after it was updated to public', async () => {
        const user = createUser({ fediversable: true })
        const [ publicItem, privateItem ] = await createItems(user, [
          { visibility: [ 'public' ] },
          { visibility: [] },
        ])
        await wait(debounceTime)
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        const res1 = await publicReq('get', outboxUrl)
        res1.orderedItems.length.should.equal(1)
        res1.orderedItems[0].object.content.should.containEql(publicItem._id)
        res1.orderedItems[0].object.content.should.not.containEql(privateItem._id)
        await updateItems({ user, ids: privateItem._id, attribute: 'visibility', value: [ 'public' ] })
        await wait(debounceTime)
        const res2 = await publicReq('get', outboxUrl)
        res2.orderedItems.length.should.equal(1)
        res2.orderedItems[0].object.content.should.containEql(publicItem._id)
        res2.orderedItems[0].object.content.should.containEql(privateItem._id)
      })
    })

    describe('create:items', () => {
      it('should return an activity when creating items in bulk', async () => {
        const user = createUser({ fediversable: true })
        await createItems(user, [ { visibility: [ 'public' ] }, { visibility: [ 'public' ] } ])
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        await wait(debounceTime)
        const res = await publicReq('get', outboxUrl)
        res.orderedItems.length.should.equal(1)
      })

      it('should return an activity when creating items sequentially', async () => {
        const user = createUser({ fediversable: true })
        await createItem(user)
        await createItem(user)
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        await wait(debounceTime)
        const res = await publicReq('get', outboxUrl)
        res.orderedItems.length.should.equal(1)
      })

      it('should return several activities when creating items at a different time', async () => {
        const user = createUser({ fediversable: true })
        await createItem(user)
        await wait(debounceTime)
        await createItem(user)
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        await wait(debounceTime)
        const res = await publicReq('get', outboxUrl)
        res.orderedItems.length.should.equal(2)
      })

      it('should not return recent activities', async () => {
        const user = createUser({ fediversable: true })
        await createItem(user)
        const { username } = await user
        const outboxUrl: Url = `${endpoint}${username}&offset=0`
        const res = await publicReq('get', outboxUrl)
        res.orderedItems.length.should.equal(0)
      })
    })
  })

  describe('entities', () => {
    before(function () { if (federatedMode) this.skip() })

    it('should return a first page URL', async () => {
      const { uri: authorUri } = await createHuman()
      const { uri: workUri } = await createWork()
      await addAuthor(workUri, authorUri)
      const outboxUrl: Url = `${endpoint}${getEntityActorName(authorUri)}`
      const res = await publicReq('get', outboxUrl)
      const url = `${origin}${outboxUrl}`
      res.id.should.equal(url)
      res.type.should.equal('OrderedCollection')
      res.totalItems.should.equal(1)
      res.first.should.equal(`${url}&offset=0`)
      res.next.should.equal(`${url}&offset=0`)
    })

    it('should return entities activities', async () => {
      const { uri: authorUri } = await createHuman()
      const { uri: workUri, _id: workId } = await createWork()
      await addAuthor(workUri, authorUri)
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${getEntityActorName(authorUri)}`
      const res = await publicReq('get', `${outboxUrl}&offset=0`)
      const url = `${origin}${outboxUrl}`
      res.type.should.equal('OrderedCollectionPage')
      res.partOf.should.equal(url)
      res.first.should.equal(`${url}&offset=0`)
      res.next.should.equal(`${url}&offset=10`)
      res.orderedItems.should.be.an.Array()
      res.orderedItems.length.should.equal(1)
      const createActivity = res.orderedItems[0]
      const actorUrl = makeUrl({ params: { action: 'actor', name: getEntityActorName(authorUri) } })
      const activityEndpoint = makeUrl({ params: { action: 'activity' } })
      createActivity.id.should.startWith(activityEndpoint)
      createActivity.actor.should.equal(actorUrl)
      createActivity.type.should.equal('Create')
      createActivity.object.type.should.equal('Note')
      createActivity.object.content.should.startWith('<p>')
      new URL(createActivity.object.id).searchParams.get('id').should.containEql(`inv-${workId}-`)
      createActivity.to.should.containEql('Public')
    })

    it('should paginate activities', async () => {
      const { uri: authorUri } = await createHuman()
      const { uri: workUri, _id: workId1 } = await createWork()
      const { uri: workUri2, _id: workId2 } = await createWork()
      await Promise.all([
        addAuthor(workUri, authorUri),
        addAuthor(workUri2, authorUri),
      ])
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${getEntityActorName(authorUri)}`
      const outboxQuery: Url = `${outboxUrl}&offset=0&limit=1`
      const res1 = await publicReq('get', outboxQuery)
      res1.orderedItems.length.should.equal(1)
      new URL(res1.orderedItems[0].object.id).searchParams.get('id').should.containEql(workId2)
      const outboxQuery2: Url = `${outboxUrl}&offset=1&limit=1`
      const res2 = await publicReq('get', outboxQuery2)
      res2.orderedItems.length.should.equal(1)
      new URL(res2.orderedItems[0].object.id).searchParams.get('id').should.containEql(workId1)
    })
  })

  describe('shelves', () => {
    it('reject invalid shelf id', async () => {
      try {
        const outboxUrl: Url = `${endpoint}shelf-foo`
        await publicReq('get', outboxUrl).then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid shelf id')
      }
    })

    it("reject if shelf's owner is not fediversable", async () => {
      try {
        const user = createUser({ fediversable: false })
        const { shelf } = await createShelf(user)
        const name = getActorName(shelf)
        const outboxUrl: Url = `${endpoint}${name}`
        await publicReq('get', outboxUrl).then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
        err.body.status_verbose.should.equal("shelf's owner is not on the fediverse")
      }
    })

    it('should not return network shelf', async () => {
      try {
        const user = createUser({ fediversable: true })
        const { shelf } = await createShelf(user, { visibility: [ 'friends' ] })
        const name = getActorName(shelf)
        const outboxUrl: Url = `${endpoint}${name}`
        await publicReq('get', outboxUrl).then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
        err.body.status_verbose.should.equal('not found')
      }
    })

    it('should return a first page URL', async () => {
      const { shelf } = await createShelfWithItem({}, null, getFediversableUser())
      await wait(debounceTime)
      const name = getActorName(shelf)
      const outboxUrl: Url = `${endpoint}${name}`
      const res = await publicReq('get', outboxUrl)
      const url = `${origin}${outboxUrl}`
      res.id.should.equal(url)
      res.type.should.equal('OrderedCollection')
      res.totalItems.should.equal(1)
      res.first.should.equal(`${url}&offset=0`)
      res.next.should.equal(`${url}&offset=0`)
    })

    it('should return content with items link', async () => {
      const { shelf, item } = await createShelfWithItem({}, null, getFediversableUser())
      const name = getActorName(shelf)
      await wait(debounceTime)
      const outboxUrl: Url = `${endpoint}${name}&offset=0`
      const res = await publicReq('get', outboxUrl)
      const url = `${origin}${endpoint}${name}`
      res.type.should.equal('OrderedCollectionPage')
      res.partOf.should.equal(url)
      res.first.should.equal(`${url}&offset=0`)
      res.next.should.equal(`${url}&offset=10`)
      res.orderedItems.should.be.an.Array()
      res.orderedItems.length.should.equal(1)
      const createActivity = res.orderedItems[0]
      const actorUrl = makeUrl({ params: { action: 'actor', name } })
      const activityEndpoint = makeUrl({ params: { action: 'activity' } })
      createActivity.id.should.startWith(activityEndpoint)
      createActivity.actor.should.equal(actorUrl)
      createActivity.object.content.should.containEql(item._id)
      createActivity.to.should.containEql('Public')
      createActivity.object.attachment.should.be.an.Array()
    })
  })
})
