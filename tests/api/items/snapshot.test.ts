import { saveSnapshotsInBatch } from '#controllers/items/lib/snapshot/snapshot'
import {
  addAuthor,
  addSerie,
  createEdition,
  createEditionFromWorks,
  createEditionWithWorkAndAuthor,
  createHuman,
  createWork,
  createWorkWithAuthor,
  someImageHash,
} from '#fixtures/entities'
import { humanName } from '#fixtures/text'
import { wait } from '#lib/promises'
import { getRandomString } from '#lib/utils/random_string'
import config, { federatedMode } from '#server/config'
import 'should'
import {
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
import { authReq, getUserB } from '#tests/api/utils/utils'
import type { WikimediaLanguageCode } from 'wikibase-sdk'

const debounceDelay = config.snapshotsDebounceTime + 100

describe('items:snapshot', () => {
  it("should snapshot the item's work series names", async () => {
    const workEntity = await createWork()
    const serieEntity = await addSerie(workEntity)
    await wait(100)
    const item = await authReq('post', '/api/items', { entity: workEntity.uri })
    const title = Object.values(serieEntity.labels)[0]
    item.snapshot['entity:series'].should.equal(title)
  })

  it("should snapshot the item's work series ordinal", async () => {
    const workEntity = await createWork()
    await addSerie(workEntity)
    await updateClaim({ uri: workEntity.uri, property: 'wdt:P1545', newValue: '5' })
    await wait(debounceDelay)
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
    await wait(debounceDelay)
    const updatedItem = await getItem(item)
    updatedItem.snapshot['entity:ordinal'].should.equal('5')
    await updateClaim({ uri: workEntity.uri, property: 'wdt:P1545', oldValue: '5', newValue: '6' })
    await wait(debounceDelay)
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
    await updateClaim({ uri: workUri, property: 'wdt:P50', newValue: 'wd:Q535' })
    const updatedItem = await getItem(item)
    updatedItem.snapshot['entity:image'].should.equal(edition.image.url)
  })

  describe('update', () => {
    it('should be updated when its local edition entity title changes', async () => {
      const work = await createWork()
      const { _id: entityId, uri } = await createEditionFromWorks(work)
      const item = await authReq('post', '/api/items', { entity: uri })
      const currentTitle = item.snapshot['entity:title']
      const updatedTitle = `${currentTitle.split('$$')[0]}$$${new Date().toISOString()}`
      await updateClaim({ uri: entityId, property: 'wdt:P1476', oldValue: currentTitle, newValue: updatedTitle })
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(updatedTitle)
    })

    it('should be updated when its local work entity title changes', async () => {
      const { _id: entityId, uri } = await createWork()
      const item = await authReq('post', '/api/items', { entity: uri })
      const currentTitle = item.snapshot['entity:title']
      const updatedTitle = `${currentTitle} ${new Date().toISOString()}`
      await updateLabel({ uri: entityId, lang: 'en', value: updatedTitle })
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(updatedTitle)
    })

    it('should be updated when its local serie entity title changes', async () => {
      const workEntity = await createWork()
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      const serieEntity = await addSerie(workEntity)
      await wait(debounceDelay)
      const title = Object.values(serieEntity.labels)[0]
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:series'].should.equal(title)
      const updatedTitle = `${title}-updated`
      await updateLabel({ uri: serieEntity._id, lang: 'en', value: updatedTitle })
      await wait(debounceDelay)
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
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(updateAuthorName)
    })

    it('should be updated when its local author entity title changes (work entity)', async () => {
      const workEntity = await createWorkWithAuthor()
      const item = await authReq('post', '/api/items', { entity: workEntity.uri })
      const updateAuthorName = humanName()
      const uri = workEntity.claims['wdt:P50'][0]
      await updateLabel({ uri, lang: 'en', value: updateAuthorName })
      await wait(debounceDelay)
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
      await wait(debounceDelay)
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
      await wait(debounceDelay)
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
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      const updatedAuthors = authorEntityB.labels.en
      updatedItem.snapshot['entity:authors'].should.equal(updatedAuthors)
      await revertMerge(authorEntityA.uri)
      await wait(debounceDelay)
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
      await wait(debounceDelay)
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
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal(originalLabel)
    })

    it('should be updated when its entity changes', async () => {
      const workEntityA = await createWork()
      const [ editionEntity, item ] = await Promise.all([
        createEditionFromWorks(workEntityA),
        authReq('post', '/api/items', { entity: workEntityA.uri }),
      ])
      await wait(debounceDelay)
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
      await wait(100)
      await merge(workEntity.uri, 'wd:Q3209796')
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal('Alain Damasio')
    })

    it('should be updated when its remote author entity is target for a merge', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const work = await createWork()
      const [ edition, author ] = await Promise.all([
        createEdition({ work }),
        addAuthor(work),
      ])
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      await merge(author.uri, 'wd:Q2829704')
      await wait(debounceDelay)
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:authors'].should.equal('Alain Damasio')
    })

    it('should be updated when its remote work entity is refreshed', async () => {
      const workUri = 'wd:Q93132245'
      const work = await getByUri(workUri)
      const edition = await createEdition({ work })
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      const title = item.snapshot['entity:title']
      const alteredTitle = getRandomString(10)
      const alteredSnapshot = { ...item.snapshot, 'entity:title': alteredTitle }
      await saveSnapshotsInBatch([ { key: edition.uri, value: alteredSnapshot } ])
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(alteredTitle)
      await getByUri(workUri, true)
      // The response doesn't wait for the snapshot refresh to be done to return
      await wait(2000)
      const reupdatedItem = await getItem(item)
      reupdatedItem.snapshot['entity:title'].should.equal(title)
    })

    it('should be updated when its remote author entity is refreshed', async () => {
      const authorUri = 'wd:Q47091793'
      const author = await getByUri(authorUri)
      const work = await createWorkWithAuthor(author)
      const edition = await createEdition({ work })
      const item = await authReq('post', '/api/items', { entity: edition.uri })
      const title = item.snapshot['entity:title']
      const alteredTitle = getRandomString(10)
      const alteredSnapshot = { ...item.snapshot, 'entity:title': alteredTitle }
      await saveSnapshotsInBatch([ { key: edition.uri, value: alteredSnapshot } ])
      const updatedItem = await getItem(item)
      updatedItem.snapshot['entity:title'].should.equal(alteredTitle)
      await getByUri(authorUri, true)
      // The response doesn't wait for the snapshot refresh to be done to return
      await wait(2000)
      const reupdatedItem = await getItem(item)
      reupdatedItem.snapshot['entity:title'].should.equal(title)
    })

    // TODO: add series tests
  })
})
