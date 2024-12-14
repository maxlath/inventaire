import { federatedMode } from '#server/config'
import { findOrIndexEntities } from '#tests/api/utils/entities'
import { search } from '#tests/api/utils/search'
import type { WdEntityUri } from '#types/entity'
import 'should'

const wikidataUris = [ 'wd:Q10134', 'wd:Q19852850', 'wd:Q33111', 'wd:Q42365', 'wd:Q1860' ] as WdEntityUri[]

describe('entities:languages:search', () => {
  before(async function () {
    if (federatedMode) this.skip()
    // Ensure wikidata uris are indexed in the current format
    await findOrIndexEntities(wikidataUris)
  })

  it('should find a language by its label in the requested language', async () => {
    const results = await search({ types: 'languages', search: 'Korsische', lang: 'de' })
    results.should.be.an.Array()
    const language = results[0]
    language.uri.should.equal('wd:Q33111')
  })

  it('should find a language by its label in another language', async () => {
    const results = await search({ types: 'languages', search: 'Korsische', lang: 'fr' })
    results.should.be.an.Array()
    const language = results[0]
    language.uri.should.equal('wd:Q33111')
  })

  it('should find a language by its language code', async () => {
    // Testing with "Zherong Dialect" wd:Q19852850, as its language code does not match with its label
    const results = await search({ types: 'languages', search: 'zrog' })
    results.should.be.an.Array()
    const language = results[0]
    language.uri.should.equal('wd:Q19852850')
  })

  it('should find a language by its language code despite the competition from popular languages with matching terms', async () => {
    // Testing with "Old English" wd:Q42365 as "English" wd:Q1860 would be a better match,
    // especially in French ("Anglais"), if it wasn't for the language code boost
    const results = await search({ types: 'languages', search: 'ang', lang: 'fr' })
    results.should.be.an.Array()
    const language = results[0]
    language.uri.should.equal('wd:Q42365')
  })

  it('should ignore the code case', async () => {
    const results = await search({ types: 'languages', search: 'Zrog' })
    results.should.be.an.Array()
    const language = results[0]
    language.uri.should.equal('wd:Q19852850')
  })
})
