import {
  addAuthor,
  addSerie,
  createEdition,
  createEditionFromWorks,
  createEditionWithWorkAndAuthor,
  createHuman,
  createWork,
  createWorkWithAuthor,
  getSomeWdEditionUriWithoutLocalLayer,
  someImageHash,
  someRandomImageHash,
} from '#fixtures/entities'
import { humanName, randomWords } from '#fixtures/text'
import { federatedMode, remoteEntitiesOrigin } from '#server/config'
import 'should'
import {
  addClaim,
  getByUri,
  getByUris,
  merge,
  restoreVersion,
  revertEdit,
  revertMerge,
  updateClaim,
  updateLabel,
} from '#tests/api/utils/entities'
import { getItem } from '#tests/api/utils/items'
import { authReq, getRemoteInstanceAdmin, getRemoteInstanceUser, getUserB } from '#tests/api/utils/utils'
import type { WikimediaLanguageCode } from 'wikibase-sdk'

describe('items:snapshot', () => {
  it("should snapshot the item's work series names", async () => {
    const workEntity = await createWork()
    const serieEntity = await addSerie(workEntity)
    const item = await authReq('post', '/api/items', { entity: workEntity.uri })
    const title = Object.values(serieEntity.labels)[0]
    item.snapshot['entity:series'].should.equal(title)
  })

  it("should snapshot the item's work series ordinal", async () => {
    const workEntity = await createWork()
    await addSerie(workEntity)
    await updateClaim({ uri: workEntity.uri, property: 'wdt:P1545', newValue: '5' })
    const item = await authReq('post', '/api/items', { entity: workEntity.uri })
    item.snapshot['entity:ordinal'].should.equal('5')
  })

  it("should update the item's snapshoted work data after a work claim update", async () => {
    const workEntity = await createWork()
    const [ item ] = await Promise.all([
      authReq('post', '/api/items', { entity: workEntity.uri }),
      addSerie(workEntity),
    ])
    await updateClaim({ uri: workEntity.uri, property: 'wdt:P1545', newValue: '5' })
    if (federatedMode) await getByUri(workEntity.uri, true)
    const updatedItem = await getItem(item)
    updatedItem.snapshot['entity:ordinal'].should.equal('5')
    await updateClaim({ uri: workEntity.uri, property: 'wdt:P1545', oldValue: '5', newValue: '6' })
    if (federatedMode) await getByUri(workEntity.uri, true)
    const reupdatedItem = await getItem(item)
    reupdatedItem.snapshot['entity:ordinal'].should.equal('6')
  })

  it('should snapshot data from all the works of a composite edition', async () => {
    const [ workA, workB ] = await Promise.all([
      createWork(),
      createWork(),
    ])
    const authors = await Promise.all([
      addAuthor(workA),
      addAuthor(workB),
    ])
    const series = await Promise.all([
      addSerie(workA),
      addSerie(workB),
    ])
    const edition = await createEditionFromWorks(workA, workB)
    const item = await authReq('post', '/api/items', { entity: edition.uri })
    const authorsNames = authors.map(author => author.labels.en).join(', ')
    const seriesNames = series.map(serie => serie.labels.en).join(', ')
    item.snapshot['entity:authors'].should.equal(authorsNames)
    item.snapshot['entity:series'].should.equal(seriesNames)
  })

  it('should snapshot the image of an edition', async () => {
    const edition = await createEdition()
    edition.image.url.should.equal(`/img/entities/${someImageHash}`)
    const item = await authReq('post', '/api/items', { entity: edition.uri })
    item.snapshot['entity:image'].should.equal(edition.image.url)
  })

  it('should snapshot the subtitle of an edition', async () => {
    const edition = await createEdition()
    const subtitle = edition.claims['wdt:P1680'][0]
    subtitle.should.a.String()
    const item = await authReq('post', '/api/items', { entity: edition.uri })
    item.snapshot['entity:subtitle'].should.equal(subtitle)
  })

  it('should snapshot the image of an edition after a work-related refresh', async () => {
    const edition = await createEdition()
    const item = await authReq('post', '/api/items', { entity: edition.uri })
    item.snapshot['entity:image'].should.equal(edition.image.url)
    const workUri = edition.claims['wdt:P629'][0]
    await updateClaim({ uri: workUri, property: 'wdt:P50', newValue: 'wd:Q1345582' })
    const updatedItem = await getItem(item)
    updatedItem.snapshot['entity:image'].should.equal(edition.image.url)
  })

  describe('update', () => {
    it('should be updated when its local edition entity title changes', async () => {
      const work = await createWork()
      const { uri } = await createEditionFromWorks(work)
      const item = await authReq('post', '/api/items', { entity: uri })
      const currentTitle = item.snapshot['entity:title']
      const updatedTitle = `${currentTitle.split('$$')[0]}$$${new Date().toISOString()}`
      await updateClaim({ uri, property: 'wdt:P1476', oldValue: currentTitle, newValue: updatedTitle })
      if (federatedMode) await getByUri(uri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(updatedTitle)
    })

    it('should be updated when its local work entity title changes', async () => {
      const { uri } = await createWork()
      const item = await authReq('post', '/api/items', { entity: uri })
      const currentTitle = item.snapshot['entity:title']
      const updatedTitle = `${currentTitle} ${new Date().toISOString()}`
      await updateLabel({ uri, lang: 'en', value: updatedTitle })
      if (federatedMode) await getByUri(uri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(updatedTitle)
    })

    it('should be updated when its local serie entity title changes', async () => {
      const workEntity = await createWork()
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      const serieEntity = await addSerie(workEntity)
      if (federatedMode) await getByUri(workEntity.uri, true)
      const title = Object.values(serieEntity.labels)[0]
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:series'].should.equal(title)
      const updatedTitle = `${title}-updated`
      await updateLabel({ uri: serieEntity.uri, lang: 'en', value: updatedTitle })
      if (federatedMode) await getByUri(serieEntity.uri, true)
      const reupdatedItem = await getItem(item)
      reupdatedItem.snapshot['entity:series'].should.equal(updatedTitle)
    })

    it('should be updated when its local author entity title changes (edition entity)', async () => {
      const edition = await createEditionWithWorkAndAuthor()
      const workUri = edition.claims['wdt:P629'][0]
      const { entities } = await getByUris(workUri)
      const workEntity = Object.values(entities)[0]
      const authorUri = workEntity.claims['wdt:P50'][0]
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      const updateAuthorName = humanName()
      await updateLabel({ uri: authorUri, lang: 'en', value: updateAuthorName })
      if (federatedMode) await getByUri(authorUri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(updateAuthorName)
    })

    it('should be updated when its local author entity title changes (work entity)', async () => {
      const workEntity = await createWorkWithAuthor()
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      const updateAuthorName = humanName()
      const uri = workEntity.claims['wdt:P50'][0]
      await updateLabel({ uri, lang: 'en', value: updateAuthorName })
      if (federatedMode) await getByUri(uri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(updateAuthorName)
    })

    it('should be updated when its local work entity is merged (work entity)', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const [ workEntityA, workEntityB ] = await Promise.all([
        createWork(),
        createWork(),
      ])
      const item = await authReq('post', '/api/items', { entity: workEntityA.uri })
      await merge(workEntityA.uri, workEntityB.uri)
      const updatedItem = await getItem(item)
      const updatedTitle = workEntityB.labels.en
      updatedItem.snapshot['entity:title'].should.equal(updatedTitle)
    })

    it('should be updated when its local work entity is merged (edition entity)', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const [ workEntityA, workEntityB ] = await Promise.all([
        createWork(),
        createWork(),
      ])
      const editionEntity = await createEditionFromWorks(workEntityA)
      const [ item, addedAuthor ] = await Promise.all([
        authReq('post', '/api/items', { entity: editionEntity.uri }),
        addAuthor(workEntityB),
      ])
      await merge(workEntityA.uri, workEntityB.uri)
      const updatedItem = await getItem(item)
      const authorName = Object.values(addedAuthor.labels)[0]
      updatedItem.snapshot['entity:authors'].should.equal(authorName)
    })

    it('should be updated when its local author entity is merged', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const [ authorEntityA, authorEntityB ] = await Promise.all([
        createHuman(),
        createHuman(),
      ])
      const workEntity = await createWorkWithAuthor(authorEntityA)
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      await merge(authorEntityA.uri, authorEntityB.uri)
      const updatedItem = await getItem(item)
      const updatedAuthors = authorEntityB.labels.en
      updatedItem.snapshot['entity:authors'].should.equal(updatedAuthors)
    })

    it('should be updated when its local author merge is reverted', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const [ authorEntityA, authorEntityB ] = await Promise.all([
        createHuman(),
        createHuman(),
      ])
      const workEntity = await createWorkWithAuthor(authorEntityA)
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      await merge(authorEntityA.uri, authorEntityB.uri)
      const updatedItem = await getItem(item)
      const updatedAuthors = authorEntityB.labels.en
      updatedItem.snapshot['entity:authors'].should.equal(updatedAuthors)
      await revertMerge(authorEntityA.uri)
      const reupdatedItem = await getItem(updatedItem)
      const oldAuthors = authorEntityA.labels.en
      reupdatedItem.snapshot['entity:authors'].should.equal(oldAuthors)
    })

    it('should be updated when a related local entity is restored', async () => {
      const human = await createHuman()
      const work = await createWorkWithAuthor(human)
      const edition = await createEditionFromWorks(work)
      const humanLabelLang = Object.keys(human.labels)[0] as WikimediaLanguageCode
      const originalLabel = human.labels[humanLabelLang]
      await updateLabel({ user: getUserB(), uri: human.uri, lang: humanLabelLang, value: 'foo' })
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      item.snapshot['entity:authors'].should.equal('foo')
      await restoreVersion({ patchId: `${human._id}:2` })
      if (federatedMode) await getByUri(human.uri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(originalLabel)
    })

    it('should be updated when a related local entity is reverted', async () => {
      const human = await createHuman()
      const work = await createWorkWithAuthor(human)
      const edition = await createEditionFromWorks(work)
      const humanLabelLang = Object.keys(human.labels)[0] as WikimediaLanguageCode
      const originalLabel = human.labels[humanLabelLang]
      await updateLabel({ user: getUserB(), uri: human.uri, lang: humanLabelLang, value: 'foo' })
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      item.snapshot['entity:authors'].should.equal('foo')
      await revertEdit({ patchId: `${human._id}:3` })
      if (federatedMode) await getByUri(human.uri, true)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(originalLabel)
    })

    it('should be updated when its entity changes', async () => {
      const workEntityA = await createWork()
      const [ editionEntity, item ] = await Promise.all([
        createEditionFromWorks(workEntityA),
        authReq('post', '/api/items', { entity: workEntityA.uri }),
      ])
      item.entity = editionEntity.uri
      const updatedItem = await authReq('put', '/api/items', item)
      const editionTitle = editionEntity.claims['wdt:P1476'][0]
      updatedItem.snapshot['entity:title'].should.equal(editionTitle)
    })

    // Flaky: seen to fail when called within the whole test suite
    it('should be updated when its remote work entity is target for a merge [flaky]', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const workEntity = await createWork()
      const editionEntity = await createEditionFromWorks(workEntity)
      const item = await authReq('post', '/api/items', { entity: editionEntity.uri })
      await merge(workEntity.uri, 'wd:Q3209796')
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal('Alain Damasio')
    })

    it('should be updated when its remote author entity is target for a merge [flaky]', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const work = await createWork()
      const [ edition, author ] = await Promise.all([
        createEdition({ work }),
        addAuthor(work),
      ])
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      await merge(author.uri, 'wd:Q2829704')
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal('Alain Damasio')
    })
  })

  describe('federated mode', () => {
    before(function () { if (!federatedMode) this.skip() })

    it('should update the item snapshot after an update on the remote entities origin', async () => {
      const titleA = randomWords(3)
      const titleB = randomWords(3)
      const { uri } = await createEdition({ title: titleA })
      const item = await authReq('post', '/api/items', { entity: uri })
      item.snapshot['entity:title'].should.equal(titleA)
      // Trigger a change directly on the remote instance
      await updateClaim({
        origin: remoteEntitiesOrigin,
        user: getRemoteInstanceUser(),
        uri,
        property: 'wdt:P1476',
        oldValue: titleA,
        newValue: titleB,
      })
      // Trigger an entity revision cache refresh
      // This supposes that the snapshot cache might stay outdated for as long as the entity itself
      // has not been re-requested
      await getByUri(uri)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(titleB)
    })

    it('should update the item snapshot after a merge on the remote entities origin', async () => {
      const titleA = randomWords(3)
      const titleB = randomWords(3)
      const [ { uri: uriA }, { uri: uriB } ] = await Promise.all([
        createEdition({ title: titleA }),
        createEdition({ title: titleB }),
      ])
      const item = await authReq('post', '/api/items', { entity: uriA })
      item.snapshot['entity:title'].should.equal(titleA)
      await merge(uriA, uriB, { user: getRemoteInstanceAdmin(), origin: remoteEntitiesOrigin })
      // Trigger an entity revision cache refresh
      await getByUri(uriA)
      const updatedItem = await getItem(item)
      updatedItem.entity.should.equal(uriB)
      updatedItem.snapshot['entity:title'].should.equal(titleB)
    })

    it('should revert items entity uri after a merge revert', async () => {
      const [ { uri: uriA }, { uri: uriB } ] = await Promise.all([
        createEdition(),
        createEdition(),
      ])
      const item = await authReq('post', '/api/items', { entity: uriA })
      await merge(uriA, uriB, { user: getRemoteInstanceAdmin(), origin: remoteEntitiesOrigin })
      // Trigger an entity revision cache refresh
      await getByUri(uriA)
      const updatedItem = await getItem(item)
      updatedItem.entity.should.equal(uriB)
      await revertMerge(uriA, { user: getRemoteInstanceAdmin(), origin: remoteEntitiesOrigin })
      const reupdatedItem = await getItem(item)
      reupdatedItem.entity.should.equal(uriA)
    })

    it('should update the item snapshot after an update on the remote layer', async () => {
      const uri = await getSomeWdEditionUriWithoutLocalLayer()
      const item = await authReq('post', '/api/items', { entity: uri })
      const imageHash = someRandomImageHash()
      await addClaim({
        origin: remoteEntitiesOrigin,
        user: getRemoteInstanceUser(),
        uri,
        property: 'invp:P2',
        value: imageHash,
      })
      // Trigger an entity revision cache refresh
      await getByUri(uri)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:image'].should.equal(`/img/entities/${imageHash}`)
    })
  })
})
