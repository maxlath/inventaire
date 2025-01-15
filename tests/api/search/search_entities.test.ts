import 'should'
import { map, uniq } from 'lodash-es'
import elasticsearchSettings from '#db/elasticsearch/settings/settings'
import {
  createWork,
  createHuman,
  createSerie,
  createCollection,
  createPublisher,
  sameFirstNameLabel,
  createWorkWithAuthor,
  createSerieWithAuthor,
  createWorkWithSerie,
} from '#fixtures/entities'
import { humanName, randomLongWord, randomWords } from '#fixtures/text'
import { assertNumber } from '#lib/utils/assert_types'
import { getRandomString } from '#lib/utils/random_string'
import { federatedMode } from '#server/config'
import { getByUris } from '#tests/api/utils/entities'
import { search, waitForIndexation, getIndexedDoc } from '#tests/api/utils/search'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { WdEntityUri } from '#types/entity'

const wikidataUris = [ 'wd:Q184226', 'wd:Q180736', 'wd:Q27536277', 'wd:Q225946', 'wd:Q3409094', 'wd:Q3236382' ] as WdEntityUri[]
const { max_gram: maxGram } = elasticsearchSettings.analysis.filter.edge_ngram

assertNumber(maxGram)

describe('search:entities', () => {
  let human, work, serie, collection, publisher

  before(async function () {
    // Entities are not indexed locally in federated mode
    if (federatedMode) this.skip()

    ;[ human, work, serie, publisher, collection ] = await Promise.all([
      // create and index all entities
      createHuman(),
      createWork(),
      createSerie(),
      createPublisher(),
      createCollection(),
      // Ensure wikidata uris are indexed in the current format
      getByUris(wikidataUris, null, true),
    ])

    await Promise.all([
      waitForIndexation('entities', human._id),
      waitForIndexation('entities', work._id),
      waitForIndexation('entities', serie._id),
      waitForIndexation('entities', publisher._id),
      waitForIndexation('entities', collection._id),
      ...wikidataUris.map(uri => waitForIndexation('wikidata', uri.split(':')[1])),
    ])
  })

  describe('parameters', () => {
    describe('exact', () => {
      it('should return results that contains the exact searched words', async () => {
        const humanLabel = human.labels.en
        const results = await search({ types: 'humans', search: humanLabel, exact: true })
        map(results, 'uri').should.containEql(human.uri)
      })

      it('should not return results that do not contain the exact searched words', async () => {
        const humanLabel = human.labels.en
        const humanLabelWithoutLastLetter = humanLabel.slice(0, -1)
        const results = await search({ types: 'humans', search: humanLabelWithoutLastLetter, exact: true })
        map(results, 'uri').should.not.containEql(human.uri)
      })

      it('should reject types that are not entity related', async () => {
        try {
          await search({ types: [ 'groups', 'users' ], search: 'foo', exact: true }).then(shouldNotBeCalled)
        } catch (err) {
          err.statusCode.should.equal(400)
          err.body.status_verbose.should.equal('exact search is restricted to entity types')
        }
      })

      it('should return only results including exact matches of each words', async () => {
        const humanLabel = human.labels.en
        const results = await search({ types: 'humans', search: humanLabel, lang: 'en', exact: true })
        results.length.should.be.aboveOrEqual(1)
        const labelWords = humanLabel.split(' ')
        results.forEach(result => {
          const resultLabelWords = result.label.split(' ')
          labelWords.forEach(word => {
            resultLabelWords.includes(word).should.be.true()
          })
        })
      })

      it('should accept a different word order', async () => {
        const humanLabel = human.labels.en
        const reversedLabel = humanLabel.split(' ').reverse().join(' ')
        const results = await search({ types: 'humans', search: reversedLabel, lang: 'en', exact: true })
        results.length.should.be.aboveOrEqual(1)
        results.forEach(result => result.label.should.equal(humanLabel))
      })

      it('should not return same first name human', async () => {
        const humanLabel = human.labels.en
        const almostSameLabel = sameFirstNameLabel(humanLabel)
        const almostSameHuman = await createHuman({ labels: { en: almostSameLabel } })
        await waitForIndexation('entities', almostSameHuman._id)

        const results = await search({ types: 'humans', search: humanLabel, lang: 'en', exact: true })
        results.should.be.an.Array()
        const labelsInResults = map(results, 'label')
        uniq(labelsInResults).should.deepEqual([ humanLabel ])
      })

      it('should not match on descriptions', async () => {
        const description = 'french philosopher'
        const results = await search({ types: 'humans', search: description, lang: 'en' })
        results.length.should.be.aboveOrEqual(0)
        const exactResults = await search({ types: 'humans', search: description, lang: 'en', exact: true })
        exactResults.length.should.equal(0)
      })

      it('should find a label with special characters', async () => {
        // Insert random words in the middle to mitigate a too low score due to a high term frequency
        // when running the tests several times without emptying the database
        const label = `L'eau ${randomWords(2)} en péril !`
        const work = await createWork({ labels: { fr: label } })
        await waitForIndexation('entities', work._id)
        const results = await search({ types: 'works', search: label, lang: 'fr', exact: true })
        map(results, 'uri').should.containEql(work.uri)
      })

      it('should find a label with single letter words', async () => {
        const label = getRandomString(1)
        const work = await createWork({ labels: { en: label } })
        await waitForIndexation('entities', work._id)
        const results = await search({ types: 'works', search: label, lang: 'en', exact: true, filter: 'inv' })
        map(results, 'uri').should.containEql(work.uri)
      })

      it('should ignore the case', async () => {
        // Insert random words in the middle to mitigate a too low score due to a high term frequency
        // when running the tests several times without emptying the database
        const label = `L'EAU DOUCE ${randomWords(2).toUpperCase()} EN PÉRIL`
        const work = await createWork({ labels: { fr: label.toLowerCase() } })
        await waitForIndexation('entities', work._id)
        const results = await search({ types: 'works', search: label, lang: 'fr', exact: true })
        map(results, 'uri').should.containEql(work.uri)
      })

      it('should find a label containing terms longer than the autocomplete max ngram', async () => {
        const wordLength = maxGram + 5
        const label = `${randomLongWord(wordLength)} ${randomLongWord(wordLength)} ${randomLongWord(wordLength)}`
        const work = await createWork({ labels: { de: label } })
        await waitForIndexation('entities', work._id)
        const results = await search({ types: 'works', search: label, lang: 'de', exact: true })
        map(results, 'uri').should.containEql(work.uri)
      })

      // This test is known to occasionally fail
      it('should favor matches in the requested language', async () => {
        const label = randomWords(2)
        const [ workEs, workFr ] = await Promise.all([
          createWork({ labels: { es: label } }),
          createWork({ labels: { fr: label } }),
        ])
        await Promise.all([
          waitForIndexation('entities', workEs._id),
          waitForIndexation('entities', workFr._id),
        ])
        const [ resultsEs, resultsFr ] = await Promise.all([
          search({ types: 'works', search: label, lang: 'es', exact: true }),
          search({ types: 'works', search: label, lang: 'fr', exact: true }),
        ])
        const resultsEsUris = map(resultsEs, 'uri')
        const resultsFrUris = map(resultsFr, 'uri')
        resultsEsUris.indexOf(workEs.uri).should.be.below(resultsEsUris.indexOf(workFr.uri))
        resultsFrUris.indexOf(workEs.uri).should.be.above(resultsFrUris.indexOf(workFr.uri))
      })
    })

    describe('not exact', () => {
      it('should match flattened terms', async () => {
        const doc = await getIndexedDoc('wikidata', 'Q42490')
        const firstTwoFlattenedLabelsWords = doc._source.flattenedLabels.split(' ').slice(0, 2).join(' ')
        const results = await search({ types: 'series', search: firstTwoFlattenedLabelsWords, limit: 100 })
        map(results, 'uri').should.containEql('wd:Q42490')
      })

      it('should find a label with single letter words', async () => {
        const label = getRandomString(1)
        const work = await createWork({ labels: { en: label } })
        await waitForIndexation('entities', work._id)
        const results = await search({ types: 'works', search: label, lang: 'en', filter: 'inv' })
        map(results, 'uri').should.containEql(work.uri)
      })

      it('should favor matches in the requested language', async () => {
        const label = randomWords(2)
        const [ workEs, workFr ] = await Promise.all([
          createWork({ labels: { es: label } }),
          createWork({ labels: { fr: label } }),
        ])
        await Promise.all([
          waitForIndexation('entities', workEs._id),
          waitForIndexation('entities', workFr._id),
        ])
        const [ resultsEs, resultsFr ] = await Promise.all([
          search({ types: 'works', search: label, lang: 'es' }),
          search({ types: 'works', search: label, lang: 'fr' }),
        ])
        const resultsEsUris = map(resultsEs, 'uri')
        const resultsFrUris = map(resultsFr, 'uri')
        resultsEsUris.indexOf(workEs.uri).should.be.below(resultsEsUris.indexOf(workFr.uri))
        resultsFrUris.indexOf(workEs.uri).should.be.above(resultsFrUris.indexOf(workFr.uri))
      })
    })

    describe('min score', () => {
      it('should not return results below the specified score', async () => {
        const label = `${randomLongWord(10)} ${randomLongWord(10)} ${randomLongWord(10)}`
        const almostSameLabel = sameFirstNameLabel(label)
        const [ humanA, humanB ] = await Promise.all([
          createHuman({ labels: { en: label } }),
          createHuman({ labels: { en: almostSameLabel } }),
        ])
        await Promise.all([
          waitForIndexation('entities', humanA._id),
          waitForIndexation('entities', humanB._id),
        ])
        const results = await search({ types: 'humans', search: label, lang: 'en', filter: 'inv' })
        const humanAScore = results.find(entity => entity.id === humanA._id)._score
        const humanBScore = results.find(entity => entity.id === humanB._id)._score
        humanAScore.should.be.above(humanBScore + 2)
        const minScore = Math.trunc(humanAScore - 1)
        const resultsWithMinScore = await search({ types: 'humans', search: label, lang: 'en', filter: 'inv', minScore })
        const foundIds = map(resultsWithMinScore, 'id')
        foundIds.should.containEql(humanA._id)
        foundIds.should.not.containEql(humanB._id)
      })
    })

    describe('offset', () => {
      it('should offset results', async () => {
        const types = 'works'
        const input = 'memoire'
        // Make sure there are at least 3 results matching that input
        const works = await Promise.all([
          createWork({ labels: { en: `${input} a` } }),
          createWork({ labels: { en: `${input} b` } }),
          createWork({ labels: { en: `${input} c` } }),
        ])
        await Promise.all(works.map(work => {
          return waitForIndexation('entities', work._id)
        }))
        const results = await search({ types, search: input, limit: 3, offset: 0 })
        const [ [ resultA ], [ resultB ], [ resultC ] ] = await Promise.all([
          search({ types, search: input, limit: 1, offset: 0 }),
          search({ types, search: input, limit: 1, offset: 1 }),
          search({ types, search: input, limit: 1, offset: 2 }),
        ])
        results[0].uri.should.equal(resultA.uri)
        results[1].uri.should.equal(resultB.uri)
        results[2].uri.should.equal(resultC.uri)
      })
    })
  })

  describe('humans', () => {
    it('should return a wikidata human', async () => {
      const results = await search('humans', 'Gilles Deleuze')
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('humans'))
      map(results, 'id').includes('Q184226').should.be.true()
    })

    it('should return a local human', async () => {
      const humanLabel = human.labels.en
      const results = await search('humans', humanLabel)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('humans'))
      map(results, 'id').includes(human._id).should.be.true()
    })
  })

  describe('works', () => {
    it('should return a local work', async () => {
      const workLabel = work.labels.en
      const results = await search('works', workLabel)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('works'))
      map(results, 'id').includes(work._id).should.be.true()
    })

    it('should return a wikidata work', async () => {
      const results = await search('works', 'Les Misérables')
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('works'))
      map(results, 'id').includes('Q180736').should.be.true()
    })

    it('should find a work by its author name', async () => {
      const label = humanName()
      const human = await createHuman({ labels: { en: label } })
      const work = await createWorkWithAuthor(human)
      await waitForIndexation('entities', work._id)
      const results = await search({ types: 'works', search: label, lang: 'en', filter: 'inv' })
      const foundIds = map(results, 'id')
      foundIds.should.containEql(work._id)
    })

    it('should find a work by its serie name', async () => {
      const label = getRandomString(15)
      const serie = await createSerie({ labels: { en: label } })
      const work = await createWorkWithSerie(serie)
      await waitForIndexation('entities', work._id)
      const results = await search({ types: 'works', search: label, lang: 'en', filter: 'inv' })
      const foundIds = map(results, 'id')
      foundIds.should.containEql(work._id)
    })
  })

  describe('series', () => {
    it('should return a local serie', async () => {
      const serieLabel = serie.labels.en
      const results = await search('series', serieLabel)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('series'))
      map(results, 'id').includes(serie._id).should.be.true()
    })

    it('should return a wikidata serie', async () => {
      const results = await search('series', 'Adamsberg')
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('series'))
      map(results, 'id').includes('Q27536277').should.be.true()
    })

    it('should find a serie by its author name', async () => {
      const label = humanName()
      const human = await createHuman({ labels: { en: label } })
      const serie = await createSerieWithAuthor({ human })
      await waitForIndexation('entities', serie._id)
      const results = await search({ types: 'series', search: label, lang: 'en', filter: 'inv' })
      const foundIds = map(results, 'id')
      foundIds.should.containEql(serie._id)
    })
  })

  describe('collections', () => {
    it('should return a local collection [flaky]', async () => {
      const collectionLabel = collection.claims['wdt:P1476'][0]
      // Without filter=inv, Wikidata collections sharing a word with the collectionLabel take all the place
      // and the test often fails
      // TODO: fix exact match
      const results = await search({ types: 'collections', search: collectionLabel, filter: 'inv' })
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('collections'))
      map(results, 'id').includes(collection._id).should.be.true()
    })

    it('should return a wikidata collection', async () => {
      const results = await search('collections', 'Présence du futur')
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('collections'))
      map(results, 'id').includes('Q3409094').should.be.true()
    })

    it('should find a collection by its publisher name', async () => {
      const label = randomWords()
      const publisher = await createPublisher({ labels: { en: label } })
      const collection = await createCollection({
        claims: {
          'wdt:P123': [ publisher.uri ],
        },
      })
      await waitForIndexation('entities', collection._id)
      const results = await search({ types: 'collections', search: label, lang: 'en', filter: 'inv' })
      const foundIds = map(results, 'id')
      foundIds.should.containEql(collection._id)
    })
  })

  describe('publishers', () => {
    it('should return a local publisher', async () => {
      const publisherLabel = publisher.labels.en
      const results = await search('publishers', publisherLabel)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('publishers'))
      map(results, 'id').includes(publisher._id).should.be.true()
    })

    it('should return a wikidata publisher', async () => {
      const results = await search('publishers', 'Les liens qui libèrent')
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('publishers'))
      map(results, 'id').includes('Q3236382').should.be.true()
    })
  })

  describe('multi-types', () => {
    it('should accept several types', async () => {
      const types = [ 'works', 'series' ]
      const results = await search({ types, search: serie.labels.en, limit: 20 })
      results.forEach(result => types.should.containEql(result.type))
      map(results, 'id').includes(serie._id).should.be.true()
    })
  })

  it('should find a label with diacritics without those diacritics', async () => {
    const results = await search({ types: 'publishers', search: 'liberent', filter: 'wd' })
    map(results, 'uri').should.containEql('wd:Q3236382')
  })
})
