import 'should'
import { unprefixify } from '#controllers/entities/lib/prefix'
import { indexesNamesByBaseNames } from '#db/elasticsearch/indexes'
import { getSomeWdEditionUri } from '#fixtures/entities'
import { wait } from '#lib/promises'
import config, { federatedMode } from '#server/config'
import { addClaim, getByUri } from '#tests/api/utils/entities'
import { getIndexedDoc, deindex, indexPlaceholder } from '#tests/api/utils/search'
import { getAdminUser } from '#tests/api/utils/utils'

const { wikidata: wikidataIndex } = indexesNamesByBaseNames
const { updateDelay: elasticsearchUpdateDelay } = config.elasticsearch

describe('indexation:wikidata', () => {
  before(function () {
    // Entities are not indexed locally in federated mode
    if (federatedMode) this.skip()
  })
  // Flaky tests: seen to fail when called within the whole test suite
  // Running `lev db/leveldb-tests --prefix '!job'` revealed that jobs
  // were waiting in the queue for some reason
  it('should index a wikidata entity when refreshed [flaky]', async () => {
    const id = 'Q94973707'
    const uri = `wd:${id}`
    await deindex(wikidataIndex, id)
    await getByUri(uri, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, id)
    result.found.should.be.true()
    result._source.type.should.equal('work')
  })

  it('should not index a wikidata entity of type meta', async () => {
    const id = 'Q2348445'
    const uri = `wd:${id}`
    await deindex(wikidataIndex, id)
    await getByUri(uri, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, id, { retry: false })
    result.found.should.be.false()
  })

  it('should not index a wikidata entity of unknown type', async () => {
    const id = 'Q15026'
    const uri = `wd:${id}`
    await deindex(wikidataIndex, id)
    await getByUri(uri, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, id, { retry: false })
    result.found.should.be.false()
  })

  it('should index the popularity [flaky]', async () => {
    const id = 'Q94973707'
    const uri = `wd:${id}`
    await deindex(wikidataIndex, id)
    await getByUri(uri, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, id)
    result.found.should.be.true()
    result._source.popularity.should.a.Number()
  })

  it('should deindex a wikidata entity when redirected', async () => {
    const redirectedEntityId = 'Q105045498'
    await indexPlaceholder(wikidataIndex, redirectedEntityId)
    await getByUri(`wd:${redirectedEntityId}`, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, redirectedEntityId, { retry: false })
    result.found.should.be.false()
  })

  it('should deindex a wikidata entity when deleted [flaky]', async () => {
    const deletedEntityId = 'Q6'
    await indexPlaceholder(wikidataIndex, deletedEntityId)
    await getByUri(`wd:${deletedEntityId}`, true)
    await wait(elasticsearchUpdateDelay)
    const result = await getIndexedDoc(wikidataIndex, deletedEntityId, { retry: false })
    result.found.should.be.false()
  })

  it('should correctly index type locked entities [flaky]', async () => {
    const uri = await getSomeWdEditionUri()
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    const result = await getIndexedDoc(wikidataIndex, unprefixify(uri))
    result._source.type.should.equal('work')
  })
})
