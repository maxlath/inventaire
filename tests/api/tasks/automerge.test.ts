import 'should'
import ASCIIFolder from 'fold-to-ascii'
import { cloneDeep } from 'lodash-es'
import { putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { prefixifyIsbn } from '#controllers/entities/lib/prefix'
import { generateIsbn13, createHuman, createWorkWithAuthor, randomLabel, createEdition } from '#fixtures/entities'
import { newError } from '#lib/error/error'
import { buildLocalUserAcct } from '#lib/federation/remote_user'
import { federatedMode } from '#server/config'
import { getByUris, findOrIndexEntities, deleteByUris } from '#tests/api/utils/entities'
import { checkEntities } from '#tests/api/utils/tasks'
import type { EntityUri } from '#types/entity'

describe('tasks:automerge', () => {
  before(async () => {
    // Tests dependency: having a populated ElasticSearch wikidata index
    const wikidataUris: EntityUri[] = [ 'wd:Q205739', 'wd:Q1748845', 'wd:Q2829704', 'wd:Q2300248', 'wd:Q259507' ]
    await findOrIndexEntities(wikidataUris)
  })

  it('should automerge if author has homonyms but only one has occurrences', async function () {
    if (federatedMode) this.skip()
    const humanLabel = 'Alan Moore' // homonyms wd:Q205739, wd:Q1748845
    const wdUri = 'wd:Q205739'
    const workLabel = 'Voice of the Fire' // wd:Q3825051, Alan Moore's work
    const human = await createHuman({ labels: { en: humanLabel } })
    await createWorkWithAuthor(human, workLabel)
    const tasks = await checkEntities(human.uri)
    tasks.length.should.equal(0)
    const { entities } = await getByUris(human.uri)
    // entity should have merged, thus URI is now a WD uri
    entities[wdUri].should.be.ok()
  })

  it('should automerge if suspect and suggestion inv works labels match', async function () {
    if (federatedMode) this.skip()
    const humanLabel = 'Alain Damasio' // wd:Q2829704
    const wikidataUri = 'wd:Q2829704'
    const workLabel = randomLabel()
    const human = await createHuman({ labels: { en: humanLabel } })
    await Promise.all([
      createWorkWithAuthor({ uri: wikidataUri }, workLabel),
      createWorkWithAuthor(human, workLabel),
    ])
    await checkEntities(human.uri)
    const { entities } = await getByUris(human.uri)
    entities[wikidataUri].should.be.ok()
  })

  it('should not automerge if author name is in work title', async function () {
    if (federatedMode) this.skip()
    const humanLabel = 'Frédéric Lordon' // wd:Q2300248
    const workLabel = humanLabel
    const human = await createHuman({ labels: { en: humanLabel } })
    await createWorkWithAuthor(human, workLabel)
    const tasks = await checkEntities(human.uri)
    tasks.length.should.aboveOrEqual(1)
    const firstOccurenceMatch = tasks[0].externalSourcesOccurrences[0].matchedTitles[0]
    firstOccurenceMatch.should.equal(normalize(humanLabel))
  })

  it('should not automerge if work title found in unstructured data source is too short', async function () {
    if (federatedMode) this.skip()
    const humanLabel = 'Penelope Curtis' // wd:Q20630876
    // string that should reasonably appear in a wikipedia article
    const shortWorkLabel = 'The'
    const human = await createHuman({ labels: { en: humanLabel } })
    await createWorkWithAuthor(human, shortWorkLabel)
    await checkEntities(human.uri)
    const { entities } = await getByUris(human.uri)
    entities[human.uri].should.be.ok()
  })

  it('should automerge if authors have same external id', async function () {
    if (federatedMode) this.skip()
    const wikidataUri = 'wd:Q259507'
    const humanLabel = 'bell hooks' // label from wd:Q259507
    const claims = {
      'wdt:P648': [ 'OL2631291A' ], // OLID from wd:Q259507
    }
    const labels = { en: humanLabel }
    const human = await createHuman({ labels })
    await forceUpdateEntityClaims(human, claims)
    await checkEntities(human.uri)
    const { entities } = await getByUris(human.uri)
    entities[wikidataUri].should.be.ok()
  })

  it('should automerge author if ISBN is found on a Wikipedia article', async function () {
    if (federatedMode) this.skip()
    const wikidataUri = 'wd:Q259507'
    const humanLabel = 'bell hooks' // label from wd:Q259507
    const labels = { en: humanLabel }
    const isbn = '978-0-89608-613-5' // should appear on https://en.wikipedia.org/wiki/Bell_hooks

    const human = await createHuman({ labels })
    // make sure edition is not already existing
    await deleteByUris([ prefixifyIsbn(isbn) ])
    const work = await createWorkWithAuthor(human)
    await createEdition({
      work,
      claims: {
        'wdt:P212': [ isbn ],
      },
    })
    await checkEntities(human.uri)
    const { entities } = await getByUris(human.uri)
    entities[wikidataUri].should.be.ok()
  })

  it('should not automerge author if ISBN is not found on a Wikipedia article', async function () {
    if (federatedMode) this.skip()
    const humanLabel = 'bell hooks' // label from wd:Q259507
    const labels = { en: humanLabel }
    const isbn = generateIsbn13()

    const human = await createHuman({ labels })
    // make sure edition is not already existing
    await deleteByUris([ prefixifyIsbn(isbn) ])
    const work = await createWorkWithAuthor(human)
    await createEdition({
      work,
      claims: {
        'wdt:P212': [ isbn ],
      },
    })
    await checkEntities(human.uri)
    const { entities } = await getByUris(human.uri)
    entities[human.uri].should.be.ok()
  })
})

const normalize = (str: string) => ASCIIFolder.foldMaintaining(str.toLowerCase().normalize())

async function forceUpdateEntityClaims (entity, claims, userId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab') {
  if (federatedMode) throw newError('Tests relying on updating entities directly in the database are not available in federated mode', 500)
  // By pass API entity validations,
  // to create another entity with same claims
  const updatedDoc = cloneDeep(entity)
  Object.assign(updatedDoc.claims, claims)

  await putInvEntityUpdate({
    currentDoc: entity,
    updatedDoc,
    userAcct: buildLocalUserAcct(userId),
  })
}
