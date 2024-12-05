import should from 'should'
import { createWork, createEdition, createHuman, someOpenLibraryId, someFakeUri, someBnfId, createEditionWithIsbn, someImageHash, generateSomeRecoverableIsni } from '#fixtures/entities'
import { federatedMode } from '#server/config'
import { getByUri, addClaim, updateClaim, removeClaim, merge } from '#tests/api/utils/entities'
import { getAdminUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { EntityUri } from '#types/entity'

describe('entities:update-claims:inv', () => {
  it('should reject without uri', async () => {
    // @ts-expect-error
    await updateClaim({ property: 'wdt:P123' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: uri')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject without property', async () => {
    // @ts-expect-error
    await updateClaim({ uri: someFakeUri })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: property')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject without old-value or new-value', async () => {
    const property = 'wdt:P1104'
    await updateClaim({ uri: someFakeUri, property })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: old-value or new-value')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid uri prefix', async () => {
    const uri = 'invalidprefix:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const property = 'wdt:P1104'
    const oldValue = '1312'
    // @ts-expect-error
    await updateClaim({ uri, property, oldValue })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid uri')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an unknown entity', async () => {
    const property = 'wdt:P1104'
    const oldValue = '1312'
    await updateClaim({ uri: someFakeUri, property, oldValue })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('entity not found')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an unknown entity value', async () => {
    const work = await createWork()
    const fakeUri = 'inv:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    await updateClaim({ uri: work.uri, property: 'wdt:P50', oldValue: null, newValue: fakeUri })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid claim value: entity not found')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an update with an inappropriate remote property', async () => {
    const work = await createWork()
    // A work entity should not have pages count
    await addClaim({ uri: work.uri, property: 'wdt:P1104', value: 124 })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("works can't have a property wdt:P1104")
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an update with an inappropriate local property', async () => {
    const { uri } = await createWork()
    await addClaim({ uri, property: 'invp:P2', value: someImageHash })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("works can't have a property invp:P2")
    })
  })

  it('should reject an update with an inappropriate property datatype', async () => {
    const work = await createWork()
    await addClaim({ uri: work.uri, property: 'wdt:P50', value: 124 })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid value type: expected string, got number')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject adding an extra value to a property that accepts only one value', async () => {
    const edition = await createEdition()
    // An edition entity should have only one date of publication
    await addClaim({ uri: edition.uri, property: 'wdt:P577', value: '2010' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('this property accepts only one value')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an update with an invalid property value', async () => {
    const edition = await createEdition()
    await addClaim({ uri: edition.uri, property: 'wdt:P123', value: 'not an entity uri' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid property value')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an update removing a critical claim', async () => {
    const edition = await createEdition()
    const oldValue = edition.claims['wdt:P629'][0]
    // An edition entity should always have at least one wdt:P629 claim
    await removeClaim({ uri: edition.uri, property: 'wdt:P629', value: oldValue })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('an edition should have an associated work (wdt:P629)')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject an update on an unexisting claim (property with no claim)', async () => {
    const edition = await createEdition()
    await updateClaim({ uri: edition.uri, property: 'wdt:P655', oldValue: 'wd:Q23', newValue: 'wd:Q42' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('claim property value not found')
    })
  })

  it('should reject an update on an unexisting claim (property with claims)', async () => {
    const edition = await createEdition()
    await addClaim({ uri: edition.uri, property: 'wdt:P655', value: 'wd:Q535' })
    await updateClaim({ uri: edition.uri, property: 'wdt:P655', oldValue: 'wd:Q23', newValue: 'wd:Q42' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('claim property value not found')
    })
  })

  it('should reject an update on an obsolete entity', async function () {
    if (federatedMode) this.skip()
    const [ workA, workB ] = await Promise.all([
      createWork(),
      createWork(),
    ])
    await merge(workA.uri, workB.uri)
    await addClaim({ uri: workA.uri, property: 'wdt:P50', value: 'wd:Q535' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('this entity is obsolete')
    })
  })

  it('should accept an update from an isbn uri', async () => {
    const edition = await createEditionWithIsbn()
    const { uri } = edition
    uri.should.startWith('isbn:')
    const res = await updateClaim({ uri, property: 'wdt:P437', newValue: 'wd:Q128093' })
    res.ok.should.be.true()
  })

  it('should accept rapid updates on the same entity', async () => {
    const authorsUris = [ 'wd:Q192214', 'wd:Q206685' ]
    const work = await createWork()
    const responses = await Promise.all(authorsUris.map(uri => {
      return addClaim({
        uri: work.uri,
        property: 'wdt:P50',
        value: uri,
      })
    }))
    responses.forEach(res => res.ok.should.be.true())
    const updatedWork = await getByUri(work.uri)
    const addedAuthorsUris = updatedWork.claims['wdt:P50']
    authorsUris.forEach(uri => should(addedAuthorsUris.includes(uri)).be.true())
  })

  it('should accept a non-duplicated concurrent value', async () => {
    const human = await createHuman()
    const res = await addClaim({ uri: human._id, property: 'wdt:P648', value: someOpenLibraryId() })
    res.ok.should.be.true()
  })

  it('should reject an invalid value for a type-specific value format', async () => {
    const human = await createHuman()
    await updateClaim({ uri: human.uri, property: 'wdt:P648', newValue: someOpenLibraryId('work') })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value for entity type "human"')
    })
  })

  it('should reject changing the wdt:P31 type', async () => {
    const edition = await createEdition()
    await updateClaim({ uri: edition.uri, property: 'wdt:P31', oldValue: 'wd:Q3331189', newValue: 'wd:Q47461344' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value for entity type "edition"')
    })
  })

  it('should accept an allowlisted value for a constrained property', async () => {
    const edition = await createEdition()
    const res = await updateClaim({ uri: edition.uri, property: 'wdt:P437', newValue: 'wd:Q128093' })
    res.ok.should.be.true()
  })

  it('should reject a non-allowlisted value for a constrained property', async () => {
    const edition = await createEdition()
    await updateClaim({ uri: edition.uri, property: 'wdt:P437', newValue: 'wd:Q123' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value for entity type "edition"')
    })
  })

  it('should reject removing the wdt:P31 claim', async () => {
    const edition = await createEdition()
    await updateClaim({ uri: edition.uri, property: 'wdt:P31', oldValue: 'wd:Q3331189', newValue: null })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("wdt:P31 array can't be empty")
    })
  })

  it('should accept a dataadmin editing an adminUpdateOnly property', async function () {
    if (federatedMode) this.skip()
    const edition = await createEditionWithIsbn()
    const oldValue = edition.claims['wdt:P957'][0]
    const uri: EntityUri = `inv:${edition._id}`
    const res = await updateClaim({ uri, property: 'wdt:P957', oldValue, newValue: null, user: getAdminUser() })
    res.ok.should.be.true()
  })

  it('should reject a non-admin editing an adminUpdateOnly property', async () => {
    const edition = await createEditionWithIsbn()
    const oldValue = edition.claims['wdt:P957'][0]
    const uri: EntityUri = `inv:${edition._id}`
    await updateClaim({ uri, property: 'wdt:P957', oldValue, newValue: null })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(403)
      err.body.status_verbose.should.equal("updating property requires admin's rights")
    })
  })

  it('should reject a non-allowlisted value for a given entity type', async () => {
    const edition = await createEdition()
    await updateClaim({ uri: edition.uri, property: 'wdt:P31', oldValue: 'wd:Q3331189', newValue: 'wd:Q5' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value for entity type "edition"')
    })
  })

  it('should reject an update with a duplicated concurrent value', async () => {
    const id = someOpenLibraryId()
    const human = await createHuman()
    const res = await addClaim({ uri: human.uri, property: 'wdt:P648', value: id })
    res.ok.should.be.true()
    const human2 = await createHuman()
    await addClaim({ uri: human2.uri, property: 'wdt:P648', value: id })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid claim value: this property value is already used')
    })
  })

  it('should accept a recoverable ISNI', async () => {
    const human = await createHuman()
    const someRecoverableIsni = generateSomeRecoverableIsni()
    const someValidIsni = someRecoverableIsni.replace(/\s/g, '')
    await addClaim({ uri: human.uri, property: 'wdt:P213', value: someRecoverableIsni })
    const updatedHuman = await getByUri(human.uri)
    updatedHuman.claims['wdt:P213'].should.deepEqual([ someValidIsni ])
  })

  it('should accept a recoverable BNF id', async () => {
    const human = await createHuman()
    const someValidBnfId = someBnfId()
    const recoverableBnfId = `cb${someValidBnfId}`
    await addClaim({ uri: human.uri, property: 'wdt:P268', value: recoverableBnfId })
    const updatedHuman = await getByUri(human.uri)
    updatedHuman.claims['wdt:P268'].should.deepEqual([ someValidBnfId ])
  })

  it('should reject invp:P1 updates on local entities', async () => {
    const { uri } = await createEdition()
    await addClaim({ uri, property: 'invp:P1', value: 'wd:Q1' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('local layer can not have remote properties')
    })
  })

  it('should reject remote-entities-only properties updates', async function () {
    if (federatedMode) this.skip()
    const { uri } = await createEdition()
    await addClaim({ user: getAdminUser(), uri, property: 'invp:P3', value: 'work' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('local entity can not have remote-entity-only claims')
    })
  })
})
