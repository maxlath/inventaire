import 'should'
import { find } from 'lodash-es'
import { makeUrl, getEntityActorName, propertyLabel } from '#controllers/activitypub/lib/helpers'
import { propertiesDisplay } from '#controllers/activitypub/lib/properties_display'
import { createHuman, createEdition } from '#fixtures/entities'
import { createShelf } from '#fixtures/shelves'
import { createUser, createUsername } from '#fixtures/users'
import { i18n } from '#lib/emails/i18n/i18n'
import { publicHost, publicOrigin } from '#server/config'
import { rawRequest } from '#tests/api/utils/request'
import { getActorName } from '#tests/api/utils/shelves'
import { updateUser } from '#tests/api/utils/users'
import { publicReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

const getAttachment = async (actorName, prop) => {
  const actorUrl = makeUrl({ params: { action: 'actor', name: actorName } })
  const { attachment } = await publicReq('get', actorUrl)
  return find(attachment, { name: i18n('en', prop) })
}

describe('activitypub:actor', () => {
  it('should reject unknown actor', async () => {
    try {
      const name = createUsername()
      const actorUrl = makeUrl({ params: { action: 'actor', name } })
      await publicReq('get', actorUrl)
      .then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('not found')
      err.body.status.should.equal(404)
    }
  })

  describe('users', () => {
    it('should reject if receiver user is not on the fediverse', async () => {
      try {
        const { username } = await createUser({ fediversable: false })
        const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
        await publicReq('get', actorUrl)
        .then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.body.status_verbose.should.equal('user is not on the fediverse')
        err.body.status.should.equal(404)
      }
    })

    it('should return a json ld content type', async () => {
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const res = await rawRequest('get', actorUrl)
      res.headers['content-type'].should.startWith('application/activity+json')
    })

    it('should return a json ld file with a receiver actor url', async () => {
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
      const sharedInboxUrl = makeUrl({ params: { action: 'shared-inbox' } })
      const outboxUrl = makeUrl({ params: { action: 'outbox', name: username } })
      const res = await publicReq('get', actorUrl)
      res.type.should.equal('Person')
      res.id.should.equal(actorUrl)
      res.preferredUsername.should.equal(username)
      res.publicKey.should.be.an.Object()
      res.inbox.should.equal(inboxUrl)
      res.sharedInbox.should.equal(sharedInboxUrl)
      res.outbox.should.equal(outboxUrl)
      res.publicKey.id.should.startWith(`${actorUrl}#`)
      res.publicKey.owner.should.equal(actorUrl)
    })

    it('should use the stable username', async () => {
      const initialUsername = createUsername()
      const newUsername = createUsername()
      const user = await createUser({ fediversable: true, username: initialUsername })
      await updateUser({ user, attribute: 'username', value: newUsername })
      const canonicalActorUrl = makeUrl({ params: { action: 'actor', name: initialUsername } })
      const canonicalInboxUrl = makeUrl({ params: { action: 'inbox', name: initialUsername } })
      const canonicalOutboxUrl = makeUrl({ params: { action: 'outbox', name: initialUsername } })
      const aliasActorUrl = makeUrl({ params: { action: 'actor', name: newUsername } })
      const res2 = await publicReq('get', aliasActorUrl)
      res2.id.should.equal(canonicalActorUrl)
      res2.preferredUsername.should.equal(initialUsername)
      res2.inbox.should.equal(canonicalInboxUrl)
      res2.outbox.should.equal(canonicalOutboxUrl)
      res2.publicKey.id.should.startWith(`${canonicalActorUrl}#`)
      res2.publicKey.owner.should.equal(canonicalActorUrl)
    })

    it('should redirect to the user main url when requesting html', async () => {
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const { statusCode, headers } = await getHtml(actorUrl)
      statusCode.should.equal(302)
      headers.location.should.equal(`${publicOrigin}/users/${username}`)
    })
  })

  describe('entities', () => {
    it('should return an entity actor', async () => {
      const { uri } = await createHuman()
      const name = getEntityActorName(uri)
      const receiverUrl = makeUrl({ params: { action: 'actor', name } })
      const receiverInboxUrl = makeUrl({ params: { action: 'inbox', name } })
      const receiverOutboxUrl = makeUrl({ params: { action: 'outbox', name } })
      const body = await publicReq('get', receiverUrl)
      body['@context'].should.an.Array()
      body.type.should.equal('Person')
      body.id.should.equal(receiverUrl)
      body.publicKey.should.be.an.Object()
      body.inbox.should.equal(receiverInboxUrl)
      body.outbox.should.equal(receiverOutboxUrl)
      body.publicKey.owner.should.equal(receiverUrl)
      body.preferredUsername.should.equal(name)
    })

    it('should set an image when one is available', async () => {
      const { uri, image } = await createEdition()
      const name = getEntityActorName(uri)
      const receiverUrl = makeUrl({ params: { action: 'actor', name } })
      const body = await publicReq('get', receiverUrl)
      body.icon.url.should.endWith(image.url)
    })

    it('should set external image urls when one is available', async () => {
      const actorUrl = makeUrl({ params: { action: 'actor', name: 'wd-Q237087' } })
      const body = await publicReq('get', actorUrl)
      body.icon.url.should.startWith('https://commons.wikimedia.org/wiki/Special:FilePath')
    })

    it('should set URLs as attachment', async () => {
      const actorUrl = makeUrl({ params: { action: 'actor', name: 'wd-Q535' } })
      const { attachment } = await publicReq('get', actorUrl)
      attachment[0].type.should.equal('PropertyValue')
      attachment[0].name.should.equal(publicHost)
      attachment[0].value.should.containEql(`${publicOrigin}/entity/wd:Q535`)
      attachment[1].type.should.equal('PropertyValue')
      attachment[1].name.should.equal('wikidata.org')
      attachment[1].value.should.containEql('https://www.wikidata.org/wiki/Q535')
    })

    it('should set an ordered list of claims as attachment', async () => {
      const actorUrl = makeUrl({ params: { action: 'actor', name: 'wd-Q535' } })
      const { attachment } = await publicReq('get', actorUrl)
      attachment[2].type.should.equal('PropertyValue')
      attachment[2].name.should.equal(i18n('en', 'P135'))
      attachment[2].value.should.containEql(`${publicOrigin}/entity/wd:`)
      // check attachment order against "properties display"
      const propertiesLabels = propertiesLabelsByType('human')
      const name3 = propertiesLabels.indexOf(attachment[3].name)
      const name4 = propertiesLabels.indexOf(attachment[4].name)
      name3.should.be.below(name4)
    })

    it('should set entity claim as attachment', async () => {
      const { value } = await getAttachment('wd-Q140057', 'P941')
      value.should.containEql(`${publicOrigin}/entity/wd:`)
    })

    it('should set entity string claim as attachment', async () => {
      const { value } = await getAttachment('wd-Q140057', 'P407')
      value.should.equal('French')
    })

    it('should set date claim as attachment', async () => {
      const { value } = await getAttachment('wd-Q11859', 'P577')
      value.should.equal('1837')
    })

    it('should set URL claim as attachment', async () => {
      const { value } = await getAttachment('wd-Q856656', 'P856')
      value.should.containEql('www.la-pleiade.fr')
    })

    it('should set platform claim as attachment', async () => {
      const { value } = await getAttachment('wd-Q110436', 'P4033')
      value.should.containEql('doctorow@mamot.fr')
      value.should.containEql('https://mamot.fr/@doctorow')
    })

    it('should redirect to the entity main url when requesting html', async () => {
      const wdId = 'Q237087'
      const actorUrl = makeUrl({ params: { action: 'actor', name: `wd-${wdId}` } })
      const { statusCode, headers } = await getHtml(actorUrl)
      statusCode.should.equal(302)
      headers.location.should.equal(`${publicOrigin}/entity/wd:${wdId}`)
    })
  })

  describe('shelves', () => {
    it('should reject if receiver user is not on the fediverse', async () => {
      try {
        const user = await createUser({ fediversable: false })
        const { shelf } = await createShelf(user)
        const name = getActorName(shelf)
        const actorUrl = makeUrl({ params: { action: 'actor', name } })
        await publicReq('get', actorUrl)
        .then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.body.status_verbose.should.equal("shelf's owner is not on the fediverse")
        err.body.status.should.equal(404)
      }
    })

    it('should return a json ld file with a receiver actor url', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const actorUrl = makeUrl({ params: { action: 'actor', name } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name } })
      const outboxUrl = makeUrl({ params: { action: 'outbox', name } })
      const res = await publicReq('get', actorUrl)
      res.type.should.equal('Person')
      res.id.should.equal(actorUrl)
      res.preferredUsername.should.equal(name)
      res.publicKey.should.be.an.Object()
      res.inbox.should.equal(inboxUrl)
      res.outbox.should.equal(outboxUrl)
      res.publicKey.id.should.startWith(`${actorUrl}#`)
      res.publicKey.owner.should.equal(actorUrl)
    })

    it('should redirect to the shelf main url when requesting html', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const actorUrl = makeUrl({ params: { action: 'actor', name } })
      const { statusCode, headers } = await getHtml(actorUrl)
      statusCode.should.equal(302)
      headers.location.should.equal(`${publicOrigin}/shelves/${shelf._id}`)
    })
  })

  describe('instance', () => {
    it('should return the instance actor', async () => {
      const actorUrl = makeUrl({ params: { action: 'actor', name: 'instance' } })
      const res = await publicReq('get', actorUrl)
      res.type.should.equal('Service')
      res.id.should.equal(actorUrl)
      res.publicKey.id.should.startWith(`${actorUrl}#`)
      res.publicKey.owner.should.equal(actorUrl)
    })
  })
})

const getHtml = url => {
  return rawRequest('get', url, {
    headers: {
      accept: 'text/html',
    },
  })
}

const propertiesLabelsByType = type => Object.keys(propertiesDisplay[type]).map(propertyLabel)
