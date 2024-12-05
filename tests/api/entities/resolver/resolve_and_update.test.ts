import should from 'should'
import {
  createWork,
  createHuman,
  createEditionWithIsbn,
  someGoodReadsId,
  someLibraryThingsWorkId,
  generateIsbn13,
  createEdition,
  generateIsbn13h,
  generateSomeRecoverableIsni,
} from '#fixtures/entities'
import { wait } from '#lib/promises'
import { forceArray } from '#lib/utils/base'
import config, { federatedMode } from '#server/config'
import { getByUris, getByUri, addClaim, getHistory } from '#tests/api/utils/entities'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const resolveAndUpdate = entries => {
  entries = forceArray(entries)
  return authReq('post', '/api/entities?action=resolve', {
    entries,
    update: true,
  })
}

describe('entities:resolver:update-resolved', () => {
  it('should not update entity claim values if property exists', async () => {
    const libraryThingsWorkId = someLibraryThingsWorkId()
    const authorUri = 'wd:Q35802'
    const authorUri2 = 'wd:Q184226'
    const entry = {
      edition: { isbn: generateIsbn13() },
      works: [ {
        claims: {
          'wdt:P1085': [ libraryThingsWorkId ],
          'wdt:P50': [ authorUri ],
        },
      },
      ],
    }
    const work = await createWork()
    await addClaim({ uri: work.uri, property: 'wdt:P1085', value: libraryThingsWorkId })
    await addClaim({ uri: work.uri, property: 'wdt:P50', value: authorUri2 })
    const { entries } = await resolveAndUpdate(entry)
    const entityUri = entries[0].works[0].uri
    const { claims } = await getByUri(entityUri)
    claims['wdt:P50'].should.not.containEql(authorUri)
  })

  it('should update entities claims values if property does not exist', async () => {
    const entryA = someEntryWithAGoodReadsWorkId()
    const entryB = someEntryWithAGoodReadsWorkId()
    const libraryThingsWorkIdA = entryA.works[0].claims['wdt:P1085'][0]
    const libraryThingsWorkIdB = entryB.works[0].claims['wdt:P1085'][0]
    const [ workA, workB ] = await Promise.all([ createWork(), createWork() ])
    await Promise.all([
      addClaim({ uri: workA.uri, property: 'wdt:P1085', value: libraryThingsWorkIdA }),
      addClaim({ uri: workB.uri, property: 'wdt:P1085', value: libraryThingsWorkIdB }),
    ])
    const { entries } = await resolveAndUpdate([ entryA, entryB ])
    const workAUri = entries[0].works[0].uri
    const workBUri = entries[1].works[0].uri
    const { entities } = await getByUris([ workAUri, workBUri ])
    const updatedWorkA = entities[workAUri]
    const updatedWorkB = entities[workBUri]
    updatedWorkA.claims['wdt:P50'][0].should.equal(entryA.works[0].claims['wdt:P50'][0])
    updatedWorkB.claims['wdt:P50'][0].should.equal(entryB.works[0].claims['wdt:P50'][0])
  })

  it('should update authors claims', async () => {
    const goodReadsId = someGoodReadsId()
    const officialWebsite = 'http://Q35802.org'
    const entry = {
      edition: { isbn: generateIsbn13() },
      authors: [ {
        claims: {
          'wdt:P2963': [ goodReadsId ],
          'wdt:P856': [ officialWebsite ],
        },
      },
      ],
    }
    const human = await createHuman()
    await addClaim({ uri: human.uri, property: 'wdt:P2963', value: goodReadsId })
    const { entries } = await resolveAndUpdate(entry)
    const authorUri = entries[0].authors[0].uri
    authorUri.should.equal(human.uri)
    const { claims } = await getByUri(authorUri)
    claims['wdt:P856'].should.containEql(officialWebsite)
  })

  it('should update edition claims', async () => {
    const numberOfPages = 3
    const { uri, isbn } = await createEditionWithIsbn()
    const entry = {
      edition: {
        isbn,
        claims: { 'wdt:P1104': numberOfPages },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims } = await getByUri(uri)
    claims['wdt:P1104'].should.containEql(numberOfPages)
  })

  it('should not add a subtitle without a title matching the current title', async () => {
    const { uri, claims } = await createEdition({
      claims: {
        'wdt:P1680': [],
      },
    })
    should(claims['wdt:P1680']).not.be.ok()
    const entry = {
      edition: {
        uri,
        claims: { 'wdt:P1680': 'foo' },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims: updatedClaims } = await getByUri(uri)
    should(updatedClaims['wdt:P1680']).not.be.ok()
  })

  it('should not add a subtitle already present in the title', async () => {
    const { uri, claims } = await createEdition({
      claims: {
        'wdt:P1680': [],
      },
    })
    const title = claims['wdt:P1476'][0]
    should(claims['wdt:P1680']).not.be.ok()
    const entry = {
      edition: {
        uri,
        claims: {
          'wdt:P1476': title,
          'wdt:P1680': `Amazing ${title.toUpperCase()} - Augmented edition`,
        },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims: updatedClaims } = await getByUri(uri)
    should(updatedClaims['wdt:P1680']).not.be.ok()
  })

  // Requires a running dataseed service and config.dataseed.enabled=true
  xit('should add an image claim from an image url to the updated edition', async () => {
    const { uri: editionUri, isbn } = await createEditionWithIsbn()
    const entry = {
      edition: {
        isbn,
        image: 'https://covers.openlibrary.org/w/id/263997-M.jpg',
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims } = await getByUri(editionUri)
    claims['invp:P2'][0].should.be.ok()
  })

  // Requires a running dataseed service and config.dataseed.enabled=true
  xit('should refuse to add an invalid image', async () => {
    const validUrlButNotAnImage = `${config.getLocalOrigin()}/api/tests`
    const { isbn } = await createEditionWithIsbn()
    const entry = {
      edition: {
        isbn,
        image: validUrlButNotAnImage,
      },
    }
    try {
      await resolveAndUpdate(entry).then(shouldNotBeCalled)
    } catch (err) {
      err.statusCode.should.equal(400)
      // Having a more specific error would be nice,
      // but that's better than nothing
      err.body.status_verbose.should.equal('invalid image url')
    }
  })

  it('should not override an existing image', async () => {
    const isbn13h = generateIsbn13h()
    const edition = await createEdition({
      claims: {
        'wdt:P212': [ isbn13h ],
      },
    })
    const originalImageHash = edition.claims['invp:P2'][0]
    originalImageHash.should.be.ok()
    const entry = {
      edition: {
        isbn: isbn13h,
        image: 'https://covers.openlibrary.org/w/id/263997-M.jpg',
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims } = await getByUri(edition.uri)
    claims['invp:P2'][0].should.equal(originalImageHash)
  })

  it('should add a batch timestamp to patches', async function () {
    if (federatedMode) this.skip()
    const startTime = Date.now()
    const entryA = someEntryWithAGoodReadsWorkId()
    const entryB = someEntryWithAGoodReadsWorkId()
    const libraryThingsWorkIdA = entryA.works[0].claims['wdt:P1085'][0]
    const libraryThingsWorkIdB = entryB.works[0].claims['wdt:P1085'][0]
    const [ workA, workB ] = await Promise.all([ createWork(), createWork() ])
    await Promise.all([
      addClaim({ uri: workA.uri, property: 'wdt:P1085', value: libraryThingsWorkIdA }),
      addClaim({ uri: workB.uri, property: 'wdt:P1085', value: libraryThingsWorkIdB }),
    ])
    await resolveAndUpdate([ entryA, entryB ])
    const [ workAPatches, workBPatches ] = await Promise.all([
      getHistory(workA.uri),
      getHistory(workB.uri),
    ])
    const lastWorkAPatch = workAPatches.at(-1)
    const lastWorkBPatch = workBPatches.at(-1)
    lastWorkBPatch.batch.should.equal(lastWorkAPatch.batch)
    const { batch: batchId } = lastWorkAPatch
    batchId.should.be.a.Number()
    batchId.should.above(startTime)
    batchId.should.below(Date.now())
  })

  it('should not update if entry date is as precise as entity date', async () => {
    const year = '2020'
    const { uri, isbn } = await createEditionWithIsbn({ publicationDate: year })
    const entry = {
      edition: {
        isbn,
        claims: { 'wdt:P577': year },
      },
    }
    const { version } = await getByUri(uri)
    const preResolvedEntityVersion = version

    await resolveAndUpdate(entry)
    await wait(10)
    const { version: postResolvedVersion } = await getByUri(uri)
    postResolvedVersion.should.equal(preResolvedEntityVersion)
  })

  it('should not update if entry date disagree with entity date', async () => {
    const entryDate = '2020-01-01'
    const entityDate = '2021'
    const { uri, isbn } = await createEditionWithIsbn({ publicationDate: entityDate })
    const entry = {
      edition: {
        isbn,
        claims: { 'wdt:P577': entryDate },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims: udpatedClaims } = await getByUri(uri)
    udpatedClaims['wdt:P577'].should.deepEqual([ entityDate ])
  })

  it('should update if entry date is more precise than entity date', async () => {
    const entityDate = '2020'
    const entryDate = '2020-01-01'
    const { uri, isbn } = await createEditionWithIsbn({ publicationDate: entityDate })
    const entry = {
      edition: {
        isbn,
        claims: { 'wdt:P577': entryDate },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const { claims: udpatedClaims } = await getByUri(uri)
    udpatedClaims['wdt:P577'].should.deepEqual([ entryDate ])
  })

  it('should update if is an entry date and no current date', async () => {
    const entryDate = '2020-02-03'
    const { uri, isbn } = await createEditionWithIsbn({ publicationDate: null })
    const entry = {
      edition: {
        isbn,
        claims: { 'wdt:P577': entryDate },
      },
    }
    await resolveAndUpdate(entry)
    await wait(10)
    const updatedEntity = await getByUri(uri)
    updatedEntity.claims['wdt:P577'].should.deepEqual([ entryDate ])
  })

  it('should update authors date claims', async () => {
    const entryDate = '2020-01-01'
    const entityDate = '2020'
    const goodReadsId = someGoodReadsId()
    const entry = {
      edition: { isbn: generateIsbn13() },
      authors: [ {
        claims: {
          'wdt:P2963': [ goodReadsId ],
          'wdt:P569': [ entryDate ],
        },
      },
      ],
    }
    const human = await createHuman()
    await addClaim({ uri: human.uri, property: 'wdt:P2963', value: goodReadsId })
    await addClaim({ uri: human.uri, property: 'wdt:P569', value: entityDate })
    const { entries } = await resolveAndUpdate(entry)
    const authorUri = entries[0].authors[0].uri
    const { claims } = await getByUri(authorUri)
    claims['wdt:P569'].should.containEql(entryDate)
  })

  it('should update recoverable ids', async () => {
    const someRecoverableIsni = generateSomeRecoverableIsni()
    const someValidIsni = someRecoverableIsni.replace(/\s/g, '')
    const human = await createHuman()
    const author = {
      uri: human.uri,
      claims: {
        'wdt:P213': [ someRecoverableIsni ],
      },
    }
    await resolveAndUpdate({
      edition: { isbn: generateIsbn13() },
      authors: [ author ],
    })
    const updatedHuman = await getByUri(human.uri)
    updatedHuman.claims['wdt:P213'].should.deepEqual([ someValidIsni ])
  })

  it('should ignore empty claim arrays', async () => {
    const entityDate = '2020'
    const goodReadsId = someGoodReadsId()
    const entry = {
      edition: {
        isbn: generateIsbn13(),
      },
      authors: [
        {
          claims: {
            'wdt:P2963': [ goodReadsId ],
            'wdt:P569': [],
            'wdt:P570': [],
          },
        },
      ],
    }
    const human = await createHuman()
    await addClaim({ uri: human.uri, property: 'wdt:P2963', value: goodReadsId })
    await addClaim({ uri: human.uri, property: 'wdt:P569', value: entityDate })
    const { entries } = await resolveAndUpdate(entry)
    const authorUri = entries[0].authors[0].uri
    const { claims } = await getByUri(authorUri)
    claims['wdt:P569'].should.containEql(entityDate)
    should(claims['wdt:P570']).not.be.ok()
  })
})

const someEntryWithAGoodReadsWorkId = () => ({
  edition: { isbn: generateIsbn13() },
  works: [
    {
      claims: {
        'wdt:P1085': [ someLibraryThingsWorkId() ],
        'wdt:P50': [ 'wd:Q35802' ],
      },
    },
  ],
})
