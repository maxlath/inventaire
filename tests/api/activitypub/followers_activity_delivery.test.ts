import 'should'
import { getEntityActorName, makeUrl } from '#controllers/activitypub/lib/helpers'
import { createHuman, createWork, addAuthor } from '#fixtures/entities'
import { createItem } from '#fixtures/items'
import { createShelf } from '#fixtures/shelves'
import { randomWords } from '#fixtures/text'
import { createUser } from '#fixtures/users'
import { wait } from '#lib/promises'
import { requests_ } from '#lib/requests'
import config, { federatedMode } from '#server/config'
import { signedReq } from '#tests/api/utils/activitypub'
import { addItemsToShelf, getActorName } from '#tests/api/utils/shelves'
import { rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'
import type { ObjectType } from '#types/activity'
import type { Url } from '#types/common'

const debounceTime = config.activitypub.activitiesDebounceTime + 200

describe('followers activity delivery', () => {
  describe('users followers', () => {
    it('should post an activity to inbox', async () => {
      const user = await createUser({ fediversable: true })
      const { username } = user
      const followedActorUrl = makeUrl({ params: { action: 'actor', name: username } }) as ObjectType
      const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name: username } })
      const { remoteHost, remoteUserId, remoteUsername } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
        withSharedInbox: false,
      })
      const details = randomWords(4)
      const item = await createItem(user, { details })
      await wait(debounceTime)
      const url: Url = `${remoteHost}/inbox_inspection?username=${remoteUsername}`
      const { inbox } = await requests_.get(url)
      const createActivity = inbox.find(a => a.type === 'Create')
      createActivity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      createActivity.object.content.should.containEql(item._id)
      createActivity.object.content.should.containEql(details)
      createActivity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })

    it('should post an activity to shared inbox when available', async () => {
      const user = await createUser({ fediversable: true })
      const { username } = user
      const followedActorUrl = makeUrl({ params: { action: 'actor', name: username } }) as ObjectType
      const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name: username } })
      const { remoteHost, remoteUserId } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
        withSharedInbox: true,
      })
      const details = randomWords(4)
      const item = await createItem(user, { details })
      await wait(debounceTime)
      const sharedInspectionInboxUrl: Url = `${remoteHost}/shared_inbox_inspection`
      const { inbox: sharedInbox } = await requests_.get(sharedInspectionInboxUrl)
      const createActivity = sharedInbox[0]
      createActivity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      createActivity.object.content.should.containEql(item._id)
      createActivity.object.content.should.containEql(details)
      createActivity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })

  describe('entities followers', () => {
    it('should post an activity to inbox', async function () {
      if (federatedMode) this.skip()
      const { uri: authorUri } = await createHuman()
      const { uri: workUri, _id: workId } = await createWork()
      const followedActorUrl = makeUrl({ params: { action: 'actor', name: getEntityActorName(authorUri) } })
      const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name: getEntityActorName(authorUri) } })
      const { remoteHost, remoteUserId } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      await addAuthor(workUri, authorUri)
      await wait(500)
      const { inbox } = await requests_.get(`${remoteHost}/shared_inbox_inspection`)
      const createActivity = inbox.find(a => a.type === 'Create')
      createActivity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      createActivity.type.should.equal('Create')
      createActivity.object.type.should.equal('Note')
      createActivity.object.content.should.startWith('<p>')
      new URL(createActivity.object.id).searchParams.get('id').should.containEql(workId)
      createActivity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })

  describe('shelves followers', () => {
    it('should reject if owner is not fediversable', async () => {
      try {
        const user = await createUser({ fediversable: false })
        const { shelf } = await createShelf(user)
        const name = getActorName(shelf)

        const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
        const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name } })
        await signedReq({
          url: inboxUrl,
          object: followedActorUrl,
          type: 'Follow',
        })
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
      }
    })

    it('should reject if shelf is not public', async () => {
      try {
        const user = await createUser({ fediversable: true })
        const { shelf } = await createShelf(user, { visibility: [ 'friends' ] })
        const name = getActorName(shelf)
        const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
        const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name } })
        await signedReq({
          url: inboxUrl,
          object: followedActorUrl,
          type: 'Follow',
        })
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
      }
    })

    it('should post an activity to inbox shelves followers when adding an item to a shelf', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
      const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name } })
      const { remoteHost, remoteUserId } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      const { _id: itemId } = await createItem(user)
      await addItemsToShelf(user, shelf, [ itemId ])
      await wait(debounceTime)
      const { inbox } = await requests_.get(`${remoteHost}/shared_inbox_inspection`)
      const activity = inbox.find(a => a.type === 'Create')
      activity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      activity.object.content.should.containEql(itemId)
      activity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })

    it('should post an activity to inbox shelves followers when creating an item in a shelf', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
      const inboxUrl = makeUrl({ params: { action: 'shared-inbox', name } })
      const { remoteHost, remoteUserId } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      const { _id: itemId } = await createItem(user, {
        shelves: [ shelf._id ],
      })
      await wait(debounceTime)
      const { inbox } = await requests_.get(`${remoteHost}/shared_inbox_inspection`)
      const activity = inbox.find(a => a.type === 'Create')
      activity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      activity.object.content.should.containEql(itemId)
      activity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })
})
