import should from 'should'
import { createWork } from '#fixtures/entities'
import { getRandomString } from '#lib/utils/random_string'
import { federatedMode } from '#server/config'
import { getByUri, updateLabel, restoreVersion, getHistory, addClaim } from '#tests/api/utils/entities'
import { getUserA, getUserB } from '#tests/api/utils/utils'

describe('entities:restore', () => {
  it('should restore after label updates', async function () {
    if (federatedMode) this.skip()
    const originalLabel = getRandomString(6)
    const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
    const { uri } = await createWork({ user: userA, labels: { en: originalLabel } })
    await updateLabel({ user: userB, uri, lang: 'en', value: getRandomString(6) })
    await updateLabel({ user: userA, uri, lang: 'en', value: getRandomString(6) })
    const firstVersionPatchId = `${uri.split(':')[1]}:2`
    const res = await restoreVersion({ user: userB, patchId: firstVersionPatchId })
    res.should.be.ok()
    const work = await getByUri(uri)
    work.labels.en.should.equal(originalLabel)
    const restoredHistory = await getHistory(uri)
    restoredHistory.length.should.equal(4)
  })

  it('should restore after claim update', async function () {
    if (federatedMode) this.skip()
    const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
    const { uri } = await createWork({ user: userA, claims: { 'wdt:P50': [ 'wd:Q1174579' ] } })
    await addClaim({ user: userB, uri, property: 'wdt:P921', value: 'wd:Q3196867' })
    await addClaim({ user: userA, uri, property: 'wdt:P50', value: 'wd:Q216092' })
    const firstVersionPatchId = `${uri.split(':')[1]}:2`
    const res = await restoreVersion({ user: userB, patchId: firstVersionPatchId })
    res.should.be.ok()
    const work = await getByUri(uri)
    work.claims['wdt:P50'].should.deepEqual([ 'wd:Q1174579' ])
    should(work.claims['wdt:P921']).not.be.ok()
    const restoredHistory = await getHistory(uri)
    restoredHistory.length.should.equal(4)
  })
})
