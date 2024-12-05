import 'should'
import {
  createEdition,
  createWork,
  createItemFromEntityUri,
  createSerie,
  createHuman,
} from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { addClaim, getRefreshedPopularityByUri } from '#tests/api/utils/entities'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

describe('entities:popularity', () => {
  describe('edition', () => {
    it('should reject invalid uri', async () => {
      const invalidUri = 'inv:aliduri'
      await getRefreshedPopularityByUri(invalidUri)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.body.status_verbose.should.startWith('invalid ')
      })
    })

    it('should default to 0', async () => {
      const edition = await createEdition()
      await scoreShouldEqual(edition.uri, 0)
    })

    it('should equal the amount of instances in inventories', async function () {
      if (federatedMode) this.skip()
      const { uri } = await createEdition()
      await scoreShouldEqual(uri, 0)
      await createItemFromEntityUri({ uri })
      await scoreShouldEqual(uri, 1)
    })

    it('should count only one instance per owner', async function () {
      if (federatedMode) this.skip()
      const { uri } = await createEdition()
      await createItemFromEntityUri({ uri, item: { details: '1' } })
      await createItemFromEntityUri({ uri, item: { details: '2' } })
      await scoreShouldEqual(uri, 1)
    })
  })

  describe('work', () => {
    it('should default to 0', async function () {
      if (federatedMode) this.skip()
      const work = await createWork()
      await scoreShouldEqual(work.uri, 0)
    })

    it('should be incremented by every instances of editions', async function () {
      if (federatedMode) this.skip()
      const { uri, claims } = await createEdition()
      const workUri = claims['wdt:P629'][0]
      await scoreShouldEqual(workUri, 1)
      await createItemFromEntityUri({ uri })
      await scoreShouldEqual(workUri, 2)
    })
  })

  describe('serie', () => {
    it('should be made of the sum of its parts scores + number of parts', async function () {
      if (federatedMode) this.skip()
      const [ serie ] = await createSerieWithAWorkWithAnEditionWithAnItem()
      // 1: item
      // 1: edition
      // 1: work
      await scoreShouldEqual(serie.uri, 3)
    })
  })

  describe('human', () => {
    it('should be made of the sum of its works scores + number of works and series', async function () {
      if (federatedMode) this.skip()
      const [ human ] = await createHumanWithAWorkWithAnEditionWithAnItem()
      // 1: item
      // 1: edition
      // 1: work
      // 1: serie
      await scoreShouldEqual(human.uri, 4)
    })
  })
})

const scoreShouldEqual = async (uri, value) => {
  const score = await getRefreshedPopularityByUri(uri)
  score.should.equal(value)
}

const createSerieWithAWorkWithAnEditionWithAnItem = async () => {
  const [ work, serie ] = await Promise.all([
    createWork(),
    createSerie(),
  ])
  const [ edition ] = await Promise.all([
    createEdition({ work }),
    addClaim({ uri: work.uri, property: 'wdt:P179', value: serie.uri }),
  ])
  const item = await createItemFromEntityUri({
    uri: edition.uri,
  })
  return [ serie, work, edition, item ]
}

const createHumanWithAWorkWithAnEditionWithAnItem = async () => {
  const human = await createHuman()
  const [ serie, work, edition, item ] = await createSerieWithAWorkWithAnEditionWithAnItem()
  await Promise.all([
    addClaim({ uri: work.uri, property: 'wdt:P50', value: human.uri }),
    addClaim({ uri: serie.uri, property: 'wdt:P50', value: human.uri }),
  ])
  return [ human, serie, work, edition, item ]
}
