import jiff from 'jiff'
import { cloneDeep } from 'lodash-es'
import should from 'should'
import { someUserAcct } from '#fixtures/federation'
import { getRandomString } from '#lib/utils/random_string'
import { createBlankEntityDoc } from '#models/entity'
import { addVersionsSnapshots, createPatchDoc, revertPatch } from '#models/patch'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { InvEntity } from '#types/entity'

const validDocId = '12345678900987654321123456789012'
const userAcct = someUserAcct()
const someRev = '1-d121066d145ea067b0c6638ebd050536'
const currentDoc = {
  _id: validDocId,
  _rev: someRev,
  type: 'entity',
  created: Date.now() - 2000,
  updated: Date.now() - 1000,
  labels: {
    fr: 'yo',
  },
  claims: {
    'wdt:P31': [ 'wd:Q47461344' ],
    'wdt:P50': [ 'wd:Q535' ],
  },
  version: 4,
} as InvEntity

const updatedDoc = {
  _id: validDocId,
  _rev: someRev,
  type: 'entity',
  created: Date.now() - 2000,
  updated: Date.now(),
  labels: {
    en: 'da',
  },
  claims: {
    'wdt:P31': [ 'wd:Q47461344' ],
    'wdt:P50': [ 'wd:Q535', 'wd:Q2001' ],
    'wdt:P135': [ 'wd:Q53121' ],
  },
  version: 5,
} as InvEntity

const authorDoc = {
  _id: '42d699b333a86f2506208e7e6d0671cc',
  _rev: '4-760b982ea416be33c6938774db2cfaeb',
  type: 'entity',
  labels: { en: 'GBKaRq' },
  claims: { 'wdt:P31': [ 'wd:Q47461344' ] },
  version: 6,
  created: Date.now() - 2000,
  updated: Date.now(),
} as InvEntity

describe('patch', () => {
  describe('create', () => {
    it('should throw if passed an invalid user acct', () => {
      try {
        createPatchDoc({
          // @ts-expect-error
          userAcct: 'invalid user acct',
          currentDoc,
          updatedDoc,
        })
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid user acct')
      }
    })

    it('should throw if passed identical objects', () => {
      try {
        createPatchDoc({ userAcct, currentDoc, updatedDoc: currentDoc })
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid update: same document objects')
      }
    })

    it('should throw if there are no operations', () => {
      const docClone = cloneDeep(currentDoc)
      try {
        createPatchDoc({ userAcct, currentDoc, updatedDoc: docClone })
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('empty patch')
      }
    })

    it('should throw if passed an updated doc without id', () => {
      const invalidDoc = Object.assign({}, updatedDoc, { _id: 'invalid id' })
      try {
        createPatchDoc({ userAcct, currentDoc, updatedDoc: invalidDoc })
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid couchUuid: invalid id')
      }
    })

    it('should throw if passed an invalid doc object', () => {
      try {
        createPatchDoc({
          userAcct,
          // @ts-expect-error
          currentDoc: 'not an object',
          updatedDoc,
        })
        shouldNotBeCalled()
      } catch (err) {
        err.name.should.equal('TypeError')
      }
      try {
        createPatchDoc({
          userAcct,
          currentDoc,
          // @ts-expect-error
          updatedDoc: 'not an object',
        })
        shouldNotBeCalled()
      } catch (err) {
        err.name.should.equal('TypeError')
      }
    })

    it('should return an object of type patch', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      patch.should.be.an.Object()
      patch.type.should.equal('patch')
    })

    it('should return with user set to the user passed', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      patch.user.should.equal(userAcct)
    })

    it('should return with a timestamp', () => {
      const now = Date.now()
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      patch.timestamp.should.be.a.Number()
      should(patch.timestamp >= now).be.true()
    })

    it('should return with a patch object', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      patch.operations.should.be.an.Array()
      patch.operations.forEach(op => {
        op.should.be.an.Object()
        op.op.should.be.a.String()
        return op.path.should.be.a.String()
      })

      const updateFromPatch = jiff.patch(patch.operations, currentDoc)
      updateFromPatch.claims.should.deepEqual(updatedDoc.claims)
      updateFromPatch.labels.should.deepEqual(updatedDoc.labels)
    })

    it('should ignore data out of versioned attributes', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      const updateFromPatch = jiff.patch(patch.operations, currentDoc)
      // The version number is not part of the patch operations
      updateFromPatch.version.should.equal(currentDoc.version)
      updateFromPatch.version.should.not.equal(updatedDoc.version)
    })

    it('should return with an id based on the updated doc version number', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      patch._id.should.equal(`${updatedDoc._id}:${updatedDoc.version}`)
    })

    it('should accept an arbitrary context object', () => {
      const params = { userAcct, currentDoc, updatedDoc, context: { mergeFrom: 'bla' } }
      const patch = createPatchDoc(params)
      patch.should.be.an.Object()
      patch.type.should.equal('patch')
    })
  })

  describe('revert', () => {
    it('should revert a patch', () => {
      const patch = createPatchDoc({ userAcct, currentDoc, updatedDoc })
      const revertedDoc = revertPatch(updatedDoc, patch)
      revertedDoc.labels.should.deepEqual(currentDoc.labels)
      revertedDoc.claims.should.deepEqual(currentDoc.claims)
    })

    it('should revert an update patch', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]
      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      authorDocUpdatedB.claims['wdt:P50'] = [ 'wd:Q184226' ]
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const revertedDoc = revertPatch(authorDocUpdatedB, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535' ])
    })

    it('should revert a patch between patches', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]
      const patchA = createPatchDoc({
        userAcct,
        currentDoc: authorDoc,
        updatedDoc: authorDocUpdatedA,
      })

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      authorDocUpdatedB.claims['wdt:P50'].push('wd:Q184226')

      const revertedDoc = revertPatch(authorDocUpdatedB, patchA)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q184226' ])
    })

    it('should revert a patch between more patches', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      authorDocUpdatedB.claims['wdt:P50'].push('wd:Q184226')
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const authorDocUpdatedC = cloneDeep(authorDocUpdatedB)
      authorDocUpdatedC.claims['wdt:P50'].push('wd:Q237087')

      const revertedDoc = revertPatch(authorDocUpdatedC, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535', 'wd:Q237087' ])
    })

    it('should revert a delete patch', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      delete authorDocUpdatedB.claims['wdt:P50']
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const revertedDoc = revertPatch(authorDocUpdatedB, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535' ])
    })

    it('should revert a delete patch after the doc was re-edited', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      delete authorDocUpdatedB.claims['wdt:P50']
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const authorDocUpdatedC = cloneDeep(authorDocUpdatedB)
      authorDocUpdatedC.claims['wdt:P50'] = [ 'wd:Q237087' ]

      const revertedDoc = revertPatch(authorDocUpdatedC, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q237087', 'wd:Q535' ])
    })

    it('should revert a patch between patches on different claims', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      authorDocUpdatedB.claims['wdt:P58'] = [ 'wd:Q184226' ]
      delete authorDocUpdatedB.claims['wdt:P50']
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const revertedDoc = revertPatch(authorDocUpdatedB, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535' ])
      should(revertedDoc.claims['wdt:P58']).not.be.ok()
    })

    it('should revert successive patches', () => {
      const authorDocUpdatedA = cloneDeep(authorDoc)
      authorDocUpdatedA.claims['wdt:P50'] = [ 'wd:Q535' ]

      const authorDocUpdatedB = cloneDeep(authorDocUpdatedA)
      authorDocUpdatedB.claims['wdt:P50'].push('wd:Q184226')
      const patchB = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedA,
        updatedDoc: authorDocUpdatedB,
      })

      const authorDocUpdatedC = cloneDeep(authorDocUpdatedB)
      authorDocUpdatedC.claims['wdt:P50'].push('wd:Q42')
      const patchC = createPatchDoc({
        userAcct,
        currentDoc: authorDocUpdatedB,
        updatedDoc: authorDocUpdatedC,
      })

      let revertedDoc = revertPatch(authorDocUpdatedC, patchB)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535', 'wd:Q42' ])

      // Tests that the revert works despite the patch keeping an outdated
      // index of the value
      revertedDoc = revertPatch(revertedDoc, patchC)
      revertedDoc.claims['wdt:P50'].should.deepEqual([ 'wd:Q535' ])
    })

    it('should be able to recover from array indexes issues', () => {
      const docVersion1 = cloneDeep(authorDoc)
      const docVersion2 = cloneDeep(authorDoc)
      const docVersion3 = cloneDeep(authorDoc)
      docVersion1.claims['wdt:P50'] = [ 'wd:Q1', 'wd:Q2' ]
      docVersion2.claims['wdt:P50'] = [ 'wd:Q1', 'wd:Q3' ]
      docVersion3.claims['wdt:P50'] = [ 'wd:Q3' ]
      const patch2 = createPatchDoc({ userAcct, currentDoc: docVersion1, updatedDoc: docVersion2 })
      const patch3 = createPatchDoc({ userAcct, currentDoc: docVersion2, updatedDoc: docVersion3 })
      const docVersion4 = revertPatch(docVersion3, patch2)
      docVersion4.claims['wdt:P50'].should.deepEqual([ 'wd:Q2' ])
      const docVersion5 = revertPatch(docVersion4, patch3)
      docVersion5.claims['wdt:P50'].should.deepEqual([ 'wd:Q1', 'wd:Q2' ])
    })

    it('should reject mismatching entity and patch', () => {
      const currentDoc = {
        _id: '10b3006aab5842379c06109b8f09530e',
      }
      const patch = {
        _id: 'e03590f8b90160c9732485baa6003e18:2',
      }
      try {
        const res = revertPatch(currentDoc, patch)
        shouldNotBeCalled(res)
      } catch (err) {
        err.message.should.equal('entity and patch ids do not match')
      }
    })
  })

  describe('addSnapshots', () => {
    it('should return an array of snapshots', () => {
      const base = createBlankEntityDoc()
      const { patch, newVersion } = generateSomePatch(base)
      const patches = [ patch ]
      should(patch.snapshot).not.be.ok()
      addVersionsSnapshots(patches)
      patch.snapshot.should.be.an.Object()
      patch.snapshot.claims.should.deepEqual({})
      patch.snapshot.labels.en.should.equal(newVersion.labels.en)
      patch.snapshot.type.should.equal('entity')
      should(patch.snapshot.version).not.be.ok()
      should(patch.snapshot.created).not.be.ok()
    })
  })
})

const generateSomePatch = previousVersion => {
  const newVersion = cloneDeep(previousVersion)
  newVersion._id = validDocId
  newVersion.version++
  if (newVersion.labels.en) delete newVersion.labels.en
  else newVersion.labels = { en: getRandomString(6) }
  const patch = createPatchDoc({ userAcct, currentDoc: previousVersion, updatedDoc: newVersion })
  return { patch, newVersion }
}
