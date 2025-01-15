import 'should'
import { createWork, createEdition } from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { updateClaim, getHistory, updateLabel, removeClaim, revertEdit } from '#tests/api/utils/entities'
import { getUser as getUserA, getUserB } from '#tests/api/utils/utils'

describe('patch correction', () => {
  describe('rewrite', () => {
    it('should rewrite a patch when the same user re-updates the same claim', async function () {
      if (federatedMode) this.skip()
      const edition = await createEdition()
      await updateClaim({ uri: edition.uri, property: 'wdt:P1104', newValue: 1 })
      await updateClaim({ uri: edition.uri, property: 'wdt:P1104', oldValue: 1, newValue: 2 })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(2)
      patches[1]._rev.should.startWith('2')
      patches[1].operations.should.deepEqual([ { op: 'add', path: '/claims/wdt:P1104', value: [ 2 ] } ])
    })

    it('should not rewrite a patch when another user re-updates the same claim', async function () {
      if (federatedMode) this.skip()
      const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
      const edition = await createEdition()
      await updateClaim({ user: userA, uri: edition.uri, property: 'wdt:P1104', newValue: 1 })
      await updateClaim({ user: userB, uri: edition.uri, property: 'wdt:P1104', oldValue: 1, newValue: 2 })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(3)
      patches[2]._rev.should.startWith('1')
      patches[2].operations.should.deepEqual([
        { op: 'add', path: '/claims/wdt:P1104/0', value: 2 },
        { op: 'test', path: '/claims/wdt:P1104/1', value: 1 },
        { op: 'remove', path: '/claims/wdt:P1104/1' },
      ])
    })

    it('should rewrite a patch when the same user re-updates the same label', async function () {
      if (federatedMode) this.skip()
      const work = await createWork()
      await updateLabel({ uri: work.uri, lang: 'es', value: 'foo' })
      await updateLabel({ uri: work.uri, lang: 'es', value: 'bar' })
      const patches = await getHistory(work.uri)
      patches.length.should.equal(2)
      patches[1]._rev.should.startWith('2')
      patches[1].operations.should.deepEqual([ { op: 'add', path: '/labels/es', value: 'bar' } ])
    })
  })

  describe('delete', () => {
    it('should delete a patch when the same user deletes the claim', async function () {
      if (federatedMode) this.skip()
      const edition = await createEdition()
      await updateClaim({ uri: edition.uri, property: 'wdt:P1104', newValue: 5 })
      await removeClaim({ uri: edition.uri, property: 'wdt:P1104', value: 5 })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(1)
    })

    it('should not delete a patch when another user deletes the claim', async function () {
      if (federatedMode) this.skip()
      const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
      const edition = await createEdition()
      await updateClaim({ user: userA, uri: edition.uri, property: 'wdt:P1104', newValue: 5 })
      await removeClaim({ user: userB, uri: edition.uri, property: 'wdt:P1104', value: 5 })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(3)
    })

    it('should delete a patch when the same user reverts a claim', async function () {
      if (federatedMode) this.skip()
      const edition = await createEdition()
      await updateClaim({ uri: edition.uri, property: 'wdt:P1104', newValue: 5 })
      await revertEdit({ patchId: `${edition._id}:3` })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(1)
    })

    it('should not delete a patch when another user reverts a claim', async function () {
      if (federatedMode) this.skip()
      const [ userA, userB ] = await Promise.all([ getUserA(), getUserB() ])
      const edition = await createEdition()
      await updateClaim({ user: userA, uri: edition.uri, property: 'wdt:P1104', newValue: 5 })
      await revertEdit({ user: userB, patchId: `${edition._id}:3` })
      const patches = await getHistory(edition.uri)
      patches.length.should.equal(3)
    })
  })
})
