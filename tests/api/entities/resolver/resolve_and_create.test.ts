import { map } from 'lodash-es'
import should from 'should'
import {
  randomLabel,
  generateIsbn13,
  someGoodReadsId,
  someLibraryThingsWorkId,
  createEditionWithIsbn,
  createWork,
} from '#fixtures/entities'
import { humanName } from '#fixtures/text'
import { federatedMode } from '#server/config'
import { getByUri, getByUris, getHistory } from '#tests/api/utils/entities'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const resolveAndCreate = entry => authReq('post', '/api/entities?action=resolve', {
  entries: [ entry ],
  create: true,
})

describe('entities:resolve:create-unresolved', () => {
  it('should create unresolved edition, work and author (the trinity)', async () => {
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13() },
      works: [ { labels: { en: randomLabel() } } ],
      authors: [ { labels: { en: humanName() } } ],
    })
    const result = entries[0]
    result.edition.created.should.be.true()
    result.authors[0].created.should.be.true()
    result.works[0].created.should.be.true()
    should(result.edition.uri).be.ok()
    should(result.works[0].uri).be.ok()
    should(result.authors[0].uri).be.ok()
  })

  it('should resolve and not create an existing edition', async () => {
    const { uri, isbn } = await createEditionWithIsbn()
    const { entries } = await resolveAndCreate({ edition: { isbn } })
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal(uri)
  })

  it('should create an edition with a title and an isbn', async () => {
    const editionLabel = randomLabel()
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13(), claims: { 'wdt:P1476': editionLabel } },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const result = entries[0]
    should(result.edition.uri).be.ok()
    const { edition } = result

    const { entities } = await getByUris(edition.uri)
    const editionClaims = Object.values(entities)[0].claims
    const newEditionTitle = editionClaims['wdt:P1476'][0]

    should(editionClaims['wdt:P212'][0]).be.ok()
    newEditionTitle.should.equal(editionLabel)
  })

  it('should extract the subtitle from the title when meaningful', async () => {
    const title = randomLabel()
    const subtitle = randomLabel()
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13(), claims: { 'wdt:P1476': `${title} - ${subtitle}` } },
      works: [ { labels: { en: title } } ],
    })
    const { uri } = entries[0].edition
    const edition = await getByUri(uri)
    edition.claims['wdt:P1476'][0].should.equal(title)
    edition.claims['wdt:P1680'][0].should.equal(subtitle)
  })

  it('should create an edition with a title and no isbn', async () => {
    const editionLabel = randomLabel()
    const { entries } = await resolveAndCreate({
      edition: { claims: { 'wdt:P1476': editionLabel } },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const result = entries[0]
    result.edition.uri.should.startWith('inv:')
    const { edition } = result
    const { entities } = await getByUris(edition.uri)
    const editionClaims = Object.values(entities)[0].claims
    const newEditionTitle = editionClaims['wdt:P1476'][0]
    newEditionTitle.should.equal(editionLabel)
  })

  it('should ignore unresolved work from resolve edition', async () => {
    const { isbn } = await createEditionWithIsbn()
    const { entries } = await resolveAndCreate({
      edition: { isbn },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const entry = entries[0]
    entry.works[0].resolved.should.be.false()
    entry.works[0].created.should.be.false()
  })

  it('should add optional claims to created edition', async () => {
    const frenchLang = 'wd:Q150'
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13(), claims: { 'wdt:P407': [ frenchLang ] } },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const result = entries[0]
    should(result.edition.uri).be.ok()
    const { edition } = result
    const { entities } = await getByUris(edition.uri)
    const newWorkClaimValue = Object.values(entities)[0].claims['wdt:P407'][0]
    newWorkClaimValue.should.equal(frenchLang)
  })

  // Requires a running dataseed service and config.dataseed.enabled=true
  xit('should add an image claim from an image url to created edition', async () => {
    const { entries } = await resolveAndCreate({
      edition: {
        isbn: generateIsbn13(),
        image: 'https://covers.openlibrary.org/w/id/263997-M.jpg',
      },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const result = entries[0]
    result.edition.created.should.be.true()
    result.edition.claims['invp:P2'][0].should.be.ok()
  })

  it('should add optional claims to created works', async () => {
    const libraryThingsWorkId = someLibraryThingsWorkId()
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13() },
      works: [ { claims: { 'wdt:P1085': [ libraryThingsWorkId ] }, labels: { en: randomLabel() } } ],
    })
    const result = entries[0]
    should(result.edition.uri).be.ok()
    const { works } = result
    const { entities } = await getByUris(map(works, 'uri'))
    const newWorkClaimValue = Object.values(entities)[0].claims['wdt:P1085'][0]
    newWorkClaimValue.should.equal(libraryThingsWorkId)
  })

  it('should add optional claims to created authors', async () => {
    const goodReadsId = someGoodReadsId()
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13() },
      works: [ { labels: { en: randomLabel() } } ],
      authors: [ { claims: { 'wdt:P2963': [ goodReadsId ] }, labels: { en: humanName() } } ],
    })
    const result = entries[0]
    should(result.edition.uri).be.ok()
    const { authors } = result
    const { entities } = await getByUris(map(authors, 'uri'))
    const newWorkClaimValue = Object.values(entities)[0].claims['wdt:P2963'][0]
    newWorkClaimValue.should.equal(goodReadsId)
  })

  it('should add a batch timestamp to patches', async function () {
    if (federatedMode) this.skip()
    const startTime = Date.now()
    const entry = {
      edition: { isbn: generateIsbn13() },
      works: [ { claims: { 'wdt:P1085': [ someLibraryThingsWorkId() ] }, labels: { en: humanName() } } ],
    }
    const { entries } = await resolveAndCreate(entry)
    const result = entries[0]
    const { uri: editionUri } = result.edition
    const patches = await getHistory(editionUri)
    const patch = patches[0]
    patch.batch.should.be.a.Number()
    patch.batch.should.above(startTime)
    patch.batch.should.below(Date.now())
  })

  it('should add created authors to created works', async () => {
    const { entries } = await resolveAndCreate({
      edition: { isbn: generateIsbn13() },
      works: [ { labels: { en: randomLabel() } } ],
      authors: [ { labels: { en: humanName() } } ],
    })
    const result = entries[0]
    const workUri = result.works[0].uri
    const { entities } = await getByUris(workUri)
    const work = entities[workUri]
    const workAuthors = work.claims['wdt:P50']
    workAuthors.includes(result.authors[0].uri).should.be.true()
  })

  it('should create a work entity from the edition seed', async () => {
    const title = randomLabel()
    const dutchLangUri = 'wd:Q7411'
    const dutchLangCode = 'nl'
    const { entries } = await resolveAndCreate({
      edition: {
        isbn: generateIsbn13(),
        claims: { 'wdt:P1476': [ title ], 'wdt:P407': [ dutchLangUri ] },
      },
    })
    const work = entries[0].works[0]
    work.labels[dutchLangCode].should.equal(title)
  })

  it('should create a work entity from the edition seed', async () => {
    const title = randomLabel()
    const { entries } = await resolveAndCreate({
      edition: {
        isbn: generateIsbn13(),
        claims: {
          'wdt:P1476': [ title ],
          'wdt:P407': [ 'wd:Q7411' ],
          'wdt:P1104': [],
        },
      },
      works: [
        {
          labels: { nl: title },
          claims: {
            'wdt:P110': [],
          },
        },
      ],
    })
    const edition = entries[0].edition
    const work = entries[0].works[0]
    should(edition.claims['wdt:P1104']).not.be.ok()
    should(work.claims['wdt:P110']).not.be.ok()
  })

  it('should not create works without labels', async () => {
    const title = randomLabel()
    try {
      await resolveAndCreate({
        edition: {
          isbn: generateIsbn13(),
          claims: { 'wdt:P1476': [ title ] },
        },
        works: [ {} ],
      })
      .then(shouldNotBeCalled)
    } catch (err) {
      err.body.status_verbose.should.startWith('invalid labels')
    }
  })

  it('should reject an edition with no title', async () => {
    const { uri: workUri } = await createWork()
    await resolveAndCreate({
      edition: { claims: {} },
      works: [ { uri: workUri } ],
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('an edition should have a title')
    })
  })
})
