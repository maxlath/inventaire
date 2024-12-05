import should from 'should'
import { getWorksFromAuthorsUris } from '#controllers/entities/lib/resolver/get_works_from_authors_uris'
import {
  createWork,
  createHuman,
  someGoodReadsId,
  someLibraryThingsWorkId,
  someOpenLibraryId,
  createWorkWithAuthor,
  generateIsbn13,
  createPublisher,
  createEditionWithIsbn, randomLabel,
  generateSomeRecoverableIsni,
} from '#fixtures/entities'
import { wait } from '#lib/promises'
import { forceArray } from '#lib/utils/base'
import { federatedMode } from '#server/config'
import { addClaim, getByUri } from '#tests/api/utils/entities'
import { waitForIndexation } from '#tests/api/utils/search'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const resolve = entries => {
  entries = forceArray(entries)
  return authReq('post', '/api/entities?action=resolve', { entries })
}

describe('entities:resolve', () => {
  it('should throw when an invalid isbn is passed', async () => {
    const invalidIsbn = '9780000000000'
    try {
      await resolve({ edition: { isbn: invalidIsbn } }).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid isbn')
    }
  })

  it('should resolve an edition entry from a local ISBN', async () => {
    const { uri, isbn } = await createEditionWithIsbn()
    const entry = { edition: { isbn } }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal(uri)
  })

  it('should resolve an edition entry from an external id found on a remote entity', async () => {
    // Expect to find wdt:P648=OL22934376M on wd:Q116194196, with canonical uri=isbn:9780375759239
    const entry = { edition: { claims: { 'wdt:P648': 'OL22934376M' } } }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal('isbn:9780375759239')
  })

  it('should resolve an edition from a known edition external id', async () => {
    const openLibraryId = someOpenLibraryId('edition')
    const { invUri, uri } = await createEditionWithIsbn()
    await addClaim({ uri: invUri, property: 'wdt:P648', value: openLibraryId })
    const editionSeed = { claims: { 'wdt:P648': [ openLibraryId ] } }
    const entry = { edition: editionSeed }
    const { entries } = await resolve(entry)
    entries[0].edition.uri.should.equal(uri)
  })

  it('should resolve an edition entry from an ISBN set in the claims', async () => {
    const { isbn, isbn13h } = await createEditionWithIsbn()
    const editionSeed = { claims: { 'wdt:P212': isbn13h } }
    const entry = { edition: editionSeed }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal(`isbn:${isbn}`)
  })

  it('should resolve an edition with no ISBN to an existing edition, if the title matches', async () => {
    const { isbn, claims } = await createEditionWithIsbn()
    const editionTitle = claims['wdt:P1476'][0].toUpperCase()
    const workUri = claims['wdt:P629'][0]
    const entry = {
      edition: { claims: { 'wdt:P1476': `${editionTitle}: novel` } },
      works: [
        { uri: workUri },
      ],
    }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal(`isbn:${isbn}`)
  })

  it('should not resolve an edition with no ISBN to an existing edition, if the title does not matches', async () => {
    const { claims } = await createEditionWithIsbn()
    const workUri = claims['wdt:P629'][0]
    const entry = {
      edition: { claims: { 'wdt:P1476': 'some title' } },
      works: [
        { uri: workUri },
      ],
    }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.resolved.should.be.false()
  })

  it('should not resolve an edition with no ISBN to an existing edition, if a claim is missing on the resolved entity', async () => {
    const { claims } = await createEditionWithIsbn()
    const somePublisher = await createPublisher()
    const editionTitle = claims['wdt:P1476'][0]
    const workUri = claims['wdt:P629'][0]
    const entry = {
      edition: {
        claims: {
          'wdt:P123': somePublisher.uri,
          'wdt:P1476': editionTitle,
        },
      },
      works: [
        { uri: workUri },
      ],
    }
    const { entries } = await resolve(entry)
    entries[0].should.be.an.Object()
    entries[0].edition.resolved.should.be.false()
  })

  it('should resolve multiple entries', async () => {
    const [ editionA, editionB ] = await Promise.all([
      createEditionWithIsbn(),
      createEditionWithIsbn(),
    ])
    const { isbn: isbnA } = editionA
    const { isbn: isbnB } = editionB
    const entryA = { edition: { isbn: isbnA } }
    const entryB = { edition: { isbn: isbnB } }
    const { entries } = await resolve([ entryA, entryB ])
    entries[0].should.be.an.Object()
    entries[0].edition.uri.should.equal(`isbn:${isbnA}`)
    entries[1].should.be.an.Object()
    entries[1].edition.uri.should.equal(`isbn:${isbnB}`)
  })

  it('should reject if key "edition" is missing', async () => {
    try {
      await resolve({}).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('missing edition in entry')
    }
  })

  it('should reject when label lang is invalid', async () => {
    try {
      await resolve({
        edition: { isbn: generateIsbn13() },
        works: [ { labels: { notalang: 'foo' } } ],
      })
      .then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid label lang')
    }
  })

  it('should reject when label value is invalid', async () => {
    try {
      await resolve({
        edition: { isbn: generateIsbn13() },
        works: [ { labels: { fr: [ 'foo' ] } } ],
      })
      .then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid label')
    }
  })

  it('should reject when claims key is not an array of objects', async () => {
    try {
      await resolve({
        edition: { isbn: generateIsbn13() },
        works: [ { claims: [ 'wdt:P31: wd:Q23' ] } ],
      })
      .then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.startWith('invalid claims')
    }
  })

  it('should reject when claims value is invalid', async () => {
    const isbn = generateIsbn13()
    try {
      await resolve({
        edition: { isbn },
        works: [ { claims: { 'wdt:P50': [ 'not a valid entity uri' ] } } ],
      })
      .then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value')
      err.body.context.entry.should.be.an.Object()
      err.body.context.entry.edition.isbn.should.equal(isbn)
      err.body.context.entry.works[0].should.be.an.Object()
    }
  })

  it('should reject when claims key has an unknown property', async () => {
    const unknownProp = 'wdt:P6'
    const seed = {
      isbn: generateIsbn13(),
      claims: { [unknownProp]: [ 'wd:Q23' ] },
    }
    try {
      await resolve({ edition: seed }).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("property isn't allowlisted")
    }
  })
})

describe('entities:resolve:external-id', () => {
  it('should resolve wikidata work from external ids claim', async () => {
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      works: [ {
        claims: {
          'wdt:P1085': [ '28158' ],
        },
      },
      ],
    })
    entries[0].works.should.be.an.Array()
    entries[0].works[0].should.be.an.Object()
    entries[0].works[0].uri.should.equal('wd:Q151883')
  })

  it('should resolve inventaire work from external ids claim', async () => {
    const libraryThingsWorkId = someLibraryThingsWorkId()
    const work = await createWork()
    await addClaim({ uri: work.uri, property: 'wdt:P1085', value: libraryThingsWorkId })
    await wait(10)
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      works: [ { claims: { 'wdt:P1085': [ libraryThingsWorkId ] } } ],
    })
    entries[0].works.should.be.an.Array()
    entries[0].works[0].should.be.an.Object()
    entries[0].works[0].uri.should.equal(work.uri)
  })

  it('should resolve wikidata author from external ids claim', async () => {
    const author = {
      claims: {
        'wdt:P648': [ 'OL28127A' ],
      },
    }
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      authors: [ author ],
    })
    entries[0].authors.should.be.an.Array()
    entries[0].authors[0].should.be.an.Object()
    entries[0].authors[0].uri.should.equal('wd:Q16867')
  })

  it('should resolve inventaire author from external ids claim', async () => {
    const goodReadsId = someGoodReadsId()
    const author = await createHuman()
    await wait(10)
    await addClaim({ uri: author.uri, property: 'wdt:P2963', value: goodReadsId })
    await wait(10)
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      authors: [ { claims: { 'wdt:P2963': [ goodReadsId ] } } ],
    })
    entries[0].authors.should.be.an.Array()
    entries[0].authors[0].should.be.an.Object()
    entries[0].authors[0].uri.should.equal(author.uri)
  })

  it('should resolve with multiple external ids', async () => {
    const goodReadsId = someGoodReadsId()
    const openLibraryId = someOpenLibraryId('human')
    const claims = {
      'wdt:P648': [ openLibraryId ],
      'wdt:P2963': [ goodReadsId ],
    }
    const author = await createHuman({ claims })
    await wait(10)
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      authors: [ { claims } ],
    })
    entries[0].authors.should.be.an.Array()
    entries[0].authors[0].should.be.an.Object()
    entries[0].authors[0].uri.should.equal(author.uri)
  })

  it('should resolve recoverable ids', async () => {
    const someRecoverableIsni = generateSomeRecoverableIsni()
    const someValidIsni = someRecoverableIsni.replace(/\s/g, '')
    const human = await createHuman({
      claims: {
        'wdt:P213': [ someValidIsni ],
      },
    })
    const author = {
      claims: {
        'wdt:P213': [ someRecoverableIsni ],
      },
    }
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      authors: [ author ],
    })
    entries[0].authors[0].uri.should.equal(human.uri)
  })
})

describe('entities:resolve:in-context', () => {
  it('should resolve work from work label and author with external ids claim', async () => {
    const goodReadsId = someGoodReadsId()
    const missingWorkLabel = randomLabel()
    const otherWorkLabel = randomLabel()
    const author = await createHuman()
    await wait(10)
    await addClaim({ uri: author.uri, property: 'wdt:P2963', value: goodReadsId })
    await wait(10)
    await Promise.all([
      createWorkWithAuthor(author, missingWorkLabel),
      createWorkWithAuthor(author, otherWorkLabel),
    ])
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      works: [ { labels: { en: missingWorkLabel } } ],
      authors: [ { claims: { 'wdt:P2963': [ goodReadsId ] } } ],
    })
    should(entries[0].works[0].uri).be.ok()
  })

  it('should resolve work from author found in work author claims', async () => {
    const work = await createWorkWithAuthor()
    const { labels, claims } = work
    const { entries } = await resolve({
      edition: { isbn: generateIsbn13() },
      works: [ { labels, claims } ],
    })
    should(entries[0].works[0].uri).be.ok()
  })

  it('should not resolve work from resolved author when author have several works with same labels', async () => {
    const goodReadsId = someGoodReadsId()
    const workLabel = randomLabel()
    const author = await createHuman()
    await wait(10)
    await addClaim({ uri: author.uri, property: 'wdt:P2963', value: goodReadsId })
    await wait(10)
    await Promise.all([
      createWorkWithAuthor(author, workLabel),
      createWorkWithAuthor(author, workLabel),
    ])
    const entry = {
      edition: { isbn: generateIsbn13() },
      works: [ { labels: { en: workLabel } } ],
      authors: [ { claims: { 'wdt:P2963': [ goodReadsId ] } } ],
    }
    const { entries } = await resolve(entry)
    should(entries[0].works[0].uri).not.be.ok()
  })

  it('should resolve author from inv author with same label, and an inv work with external id', async () => {
    const libraryThingsWorkId = someLibraryThingsWorkId()
    const workLabel = randomLabel()
    const author = await createHuman()
    await wait(10)
    const work = await createWorkWithAuthor(author, workLabel)
    await addClaim({ uri: work.uri, property: 'wdt:P1085', value: libraryThingsWorkId })
    const entry = {
      edition: { isbn: generateIsbn13() },
      works: [ { claims: { 'wdt:P1085': [ libraryThingsWorkId ] } } ],
      authors: [ { labels: author.labels } ],
    }
    const { entries } = await resolve(entry)
    should(entries[0].works[0].uri).be.ok()
    should(entries[0].authors[0].uri).be.ok()
  })

  it('should resolve work from resolve edition', async () => {
    const { isbn, claims } = await createEditionWithIsbn()
    const { uri: workUri, labels } = await getByUri(claims['wdt:P629'][0])
    const { entries } = await resolve({
      edition: { isbn },
      works: [ { labels } ],
    })
    entries[0].works[0].uri.should.equal(workUri)
  })

  it('should ignore unresolved work from resolve edition', async () => {
    const { isbn } = await createEditionWithIsbn()
    const { entries } = await resolve({
      edition: { isbn },
      works: [ { labels: { en: randomLabel() } } ],
    })
    const entry = entries[0]
    entry.works[0].resolved.should.be.false()
  })
})

describe('entities:resolve:on-labels', () => {
  let author, workLabel, authorLabel, work
  before(async () => {
    if (federatedMode) return
    author = await createHuman()
    workLabel = randomLabel()
    authorLabel = author.labels.en
    work = await createWorkWithAuthor(author, workLabel)
    await waitForIndexation('entities', work._id)
  })

  it('should resolve work pair on exact match', async function () {
    if (federatedMode) this.skip()
    const { entries } = await resolve(basicEntry(workLabel, authorLabel))
    entries[0].works[0].uri.should.equal(work.uri)
    entries[0].authors[0].uri.should.equal(author.uri)
  })

  it('should resolve work pair with case insentive labels', async function () {
    if (federatedMode) this.skip()
    const upperWorkLabel = workLabel.toUpperCase()
    const { entries: entries2 } = await resolve(basicEntry(upperWorkLabel, authorLabel))
    entries2[0].works[0].uri.should.equal(work.uri)
    entries2[0].authors[0].uri.should.equal(author.uri)
  })

  it('should not resolve work pair if no labels match', async function () {
    if (federatedMode) this.skip()
    const randomWorkLabel = randomLabel()
    const { entries: entries3 } = await resolve(basicEntry(randomWorkLabel, authorLabel))
    should(entries3[0].works[0].uri).not.be.ok()
  })

  it('should not resolve when several homonym works exist', async function () {
    if (federatedMode) this.skip()
    const sameLabelAuthor = await createHuman({ labels: author.labels })
    const workB = await createWorkWithAuthor(sameLabelAuthor, workLabel)
    await waitForIndexation('entities', workB._id)
    const { entries } = await resolve(basicEntry(workLabel, author.labels.en))
    should(entries[0].works[0].uri).not.be.ok()
    should(entries[0].authors[0].uri).not.be.ok()
  })

  it('should resolve when an author has several works but only one matches', async function () {
    if (federatedMode) this.skip()
    const author = await createHuman()
    const workLabel = randomLabel()
    const [ workA, workB ] = await Promise.all([
      createWorkWithAuthor(author, workLabel),
      createWorkWithAuthor(author, randomLabel()),
    ])
    await Promise.all([
      waitForIndexation('entities', workA._id),
      waitForIndexation('entities', workB._id),
    ])
    const { entries } = await resolve(basicEntry(workLabel, author.labels.en))
    entries[0].works[0].uri.should.equal(workA.uri)
    entries[0].authors[0].uri.should.equal(author.uri)
  })
})

describe('entities:resolve:on-external-terms', () => {
  // Fragile test: its validity depends on the stability of Wikipedia and Wikidata
  it('should resolve the author when a work label appears in Wikipedia', async function () {
    this.timeout(60000)
    const workLabel = "Mémoires d'outre-espace"
    const authorLabel = 'Enki Bilal'

    const works = await getWorksFromAuthorsUris([ 'wd:Q333668' ])
    const matchingWdWork = works
      .filter(work => work.uri.startsWith('wd'))
      .find(work => Object.values(work.labels).join(' ').includes('outre-espace'))
    if (matchingWdWork) throw new Error(`This test is obsolete: the Wikidata work now exists (${matchingWdWork.uri})`)

    const { entries } = await resolve(basicEntry(workLabel, authorLabel))
    entries[0].works[0].resolved.should.be.false()
    entries[0].authors[0].resolved.should.be.true()
    entries[0].authors[0].uri.should.equal('wd:Q333668')
  })
})

describe('entities:resolve:images', () => {
  it('should reject an invalid image URL', async () => {
    const editionSeed = {
      isbn: generateIsbn13(),
      image: 'not a valid URL',
    }
    const entry = { edition: editionSeed }
    try {
      await resolve(entry).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid image url')
    }
  })

  it('should reject an image on a work', async () => {
    const work = { image: 'https://covers.openlibrary.org/w/id/263997-M.jpg' }
    const entry = {
      edition: { isbn: generateIsbn13() },
      works: [ work ],
    }
    try {
      await resolve(entry).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("work can't have an image")
    }
  })
})

const basicEntry = (workLabel, authorLabel) => ({
  edition: { isbn: generateIsbn13() },
  works: [ { labels: { en: workLabel } } ],
  authors: [ { labels: { en: authorLabel } } ],
})
