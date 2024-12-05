import should from 'should'
import { createEditionWithIsbn, generateSomeRecoverableIsni, randomLabel, someOpenLibraryId, someReference } from '#fixtures/entities'
import { getSomeUsername } from '#fixtures/text'
import { federatedMode } from '#server/config'
import { getEntityAttributesByUri } from '#tests/api/utils/entities'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const endpoint = '/api/entities?action=create'

describe('entities:create', () => {
  it('should reject without from claims', async () => {
    await authReq('post', endpoint, {})
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('missing parameter in body: claims')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid claims', async () => {
    await authReq('post', endpoint, { claims: 'foo' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid claims')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject entities without a wdt:P31 claim', async () => {
    await authReq('post', '/api/entities?action=create', {
      labels: {},
      claims: {},
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("wdt:P31 array can't be empty")
    })
  })

  it('should reject entities of unknown entity types', async () => {
    await authReq('post', '/api/entities?action=create', {
      labels: { fr: randomLabel() },
      claims: { 'wdt:P31': [ 'wd:Q1' ] },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("wdt:P31 value isn't a known value")
    })
  })

  it('should reject entities of non-allowlisted entity types', async () => {
    await authReq('post', '/api/entities?action=create', {
      labels: {
        en: randomLabel(),
      },
      // Is in server/lib/wikidata/aliases.js, but gives a type 'movement'
      claims: { 'wdt:P31': [ 'wd:Q2198855' ] },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("wdt:P31 value isn't a allowlisted value")
    })
  })

  it('should reject without a label (unless specific types)', async () => {
    await authReq('post', endpoint, {
      claims: { 'wdt:P31': [ 'wd:Q47461344' ] },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid labels')
    })
  })

  it('should ignore empty claims arrays', async () => {
    const entity = await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        // Works can't have wdt:P629 claims
        'wdt:P629': [],
      },
    })
    should(entity.claims['wdt:P629']).not.be.ok()
  })

  it('should create a work entity', async () => {
    const res = await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: { 'wdt:P31': [ 'wd:Q47461344' ] },
    })
    res._id.should.be.a.String()
    res._rev.should.be.a.String()
    res.type.should.equal('work')
    res.version.should.equal(2)
    res.claims.should.deepEqual({ 'wdt:P31': [ 'wd:Q47461344' ] })
    res.uri.should.be.a.String()
    res.labels.should.be.an.Object()
  })

  it('should create claim with a type-specific value', async () => {
    const { _id } = await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wdt:P648': [ someOpenLibraryId('work') ],
      },
    })
    _id.should.be.a.String()
  })

  it('should create claim with a recoverable format error', async () => {
    const { _id } = await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wdt:P4033': [ `${getSomeUsername()}@example.org   ` ],
      },
    })
    _id.should.be.a.String()
  })

  it('should reject claims with the wrong type-specific value', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q5' ],
        'wdt:P648': [ someOpenLibraryId('work') ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.message.should.containEql('invalid property value for entity type "human"')
    })
  })

  it('should reject multiple values for a property that take one', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q5' ],
        'wdt:P569': [ '1950-04', '1950-05' ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('this property accepts only one value')
    })
  })

  it('should reject non allowlisted values for constrained properties', async () => {
    await authReq('post', endpoint, {
      claims: {
        'wdt:P31': [ 'wd:Q123' ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal("wdt:P31 value isn't a known value")
    })
  })

  it('should reject invalid labels datatype', async () => {
    await authReq('post', endpoint, {
      labels: [],
      claims: {},
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid labels')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid claims datatype', async () => {
    await authReq('post', endpoint, {
      labels: {},
      claims: [],
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid claims')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid claim property values', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wdt:P50': 'wd:Q535',
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid property claim array')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid prefix properties', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wd:P50': [ 'wd:Q535' ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid property')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject invalid claim property value', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wdt:P50': [ 'wd####Q535' ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal('invalid property value')
      err.statusCode.should.equal(400)
    })
  })

  it('should reject when concurrent property value is already taken', async () => {
    const edition = await createEditionWithIsbn()
    await authReq('post', endpoint, {
      claims: {
        'wdt:P31': [ 'wd:Q3331189' ],
        'wdt:P1476': [ randomLabel() ],
        'wdt:P629': edition.claims['wdt:P629'],
        // The concurrent property
        'wdt:P212': edition.claims['wdt:P212'],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid claim value: this property value is already used')
    })
  })

  it('should reject creation with incorrect properties', async () => {
    await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ], // work
        'wdt:P1104': [ 124 ], // edition pages counts
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.equal("works can't have a property wdt:P1104")
      err.statusCode.should.equal(400)
    })
  })

  it('should accept a recoverable ISNI', async () => {
    const someRecoverableIsni = generateSomeRecoverableIsni()
    const someValidIsni = someRecoverableIsni.replace(/\s/g, '')
    const res = await authReq('post', endpoint, {
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q5' ], // human
        'wdt:P213': [ someRecoverableIsni ],
      },
    })
    res.claims['wdt:P213'].should.deepEqual([ someValidIsni ])
  })

  it('should reject invalid prefixes', async function () {
    if (federatedMode) this.skip()
    await authReq('post', endpoint, {
      prefix: 'foo',
      labels: {},
      claims: {},
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid prefix: foo')
      err.statusCode.should.equal(400)
    })
  })

  it('should create wikidata entities', async () => {
    await authReq('post', endpoint, {
      prefix: 'wd',
      labels: { fr: randomLabel() },
      claims: {
        'wdt:P31': [ 'wd:Q47461344' ],
        'wdt:P648': [ someOpenLibraryId('work') ],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      // test oauth request sending by throwing error
      // as test env cannot have any wd tokens
      err.body.status_verbose.should.equal('missing wikidata oauth tokens')
      err.statusCode.should.equal(400)
    })
  })

  describe('references', () => {
    it('should accept references', async () => {
      await authReq('post', endpoint, {
        labels: { fr: randomLabel() },
        claims: {
          'wdt:P31': [ 'wd:Q47461344' ],
          'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ someReference ] } ],
        },
      })
    })

    it('should reject an invalid reference array', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: someReference } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid references value, should be an array')
      }
    })

    it('should reject an invalid reference', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ 123 ] } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid reference')
      }
    })

    it('should reject an empty reference object', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ {} ] } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid reference')
      }
    })

    it('should reject an invalid reference object', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ { foo: 123 } ] } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid property')
      }
    })

    it('should reject an invalid reference snak', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ { 'wdt:P854': [ 'not a url' ] } ] } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('invalid property value')
      }
    })

    it('should reject non-allowed reference properties', async () => {
      try {
        const res = await authReq('post', endpoint, {
          labels: { fr: randomLabel() },
          claims: {
            'wdt:P31': [ 'wd:Q47461344' ],
            'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ { ...someReference, 'wdt:P1104': [ 123 ] } ] } ],
          },
        })
        shouldNotBeCalled(res)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal("This property isn't allowed in a reference")
      }
    })

    it('should format reference snak values', async () => {
      const referenceUrl = 'http://foo.bar  '
      const res = await authReq('post', endpoint, {
        labels: { fr: randomLabel() },
        claims: {
          'wdt:P31': [ 'wd:Q47461344' ],
          'wdt:P648': [ { value: someOpenLibraryId('work'), references: [ { 'wdt:P854': [ referenceUrl ] } ] } ],
        },
      })
      const entity = await getEntityAttributesByUri({ uri: res.uri, attributes: [ 'claims', 'references' ] as const })
      // @ts-expect-error
      entity.claims['wdt:P648'][0].references[0]['wdt:P854'][0].should.equal(referenceUrl.trim())
    })
  })
})

// See also: editions/create.test.js
