import should from 'should'
import { sanitize, validateSanitization } from '#lib/sanitize/sanitize'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

describe('sanitize', () => {
  it('should reject invalid req objects based on req.query existance', async () => {
    const req = {}
    const configs = {}
    try {
      sanitize(req, {}, configs)
      shouldNotBeCalled()
    } catch (err) {
      err.name.should.equal('TypeError')
      err.message.should.startWith('expected object, got undefined')
    }
  })

  it('should add a warning for unexpected parameter (user error)', async () => {
    const req = { query: { limit: 1000 } }
    const res = {}
    const configs = {}
    const input = sanitize(req, res, configs)
    input.should.deepEqual({})
    res.warnings.should.be.an.Object()
    res.warnings.should.deepEqual([
      'unexpected parameter: limit',
    ])
  })

  it('should by default look for parameters in the body in POST and PUT requests', async () => {
    const req = { method: 'POST', body: { lang: 'es' }, query: {} }
    const res = {}
    const configs = { lang: {} }
    const { lang } = sanitize(req, res, configs)
    lang.should.equal('es')
  })

  it('should optionally look for parameters in the query in POST and PUT requests', async () => {
    const req = { method: 'POST', query: { lang: 'es' } }
    const res = {}
    const configs = { lang: {}, nonJsonBody: true }
    const { lang } = sanitize(req, res, configs)
    lang.should.equal('es')
    const { lang: lang2 } = sanitize(req, res, configs)
    lang2.should.equal('es')
  })

  it('should not remove non-parameter options from configs', async () => {
    const req = { method: 'POST', query: { lang: 'es' } }
    const res = {}
    const configs = { lang: {}, nonJsonBody: true }
    const { lang } = sanitize(req, res, configs)
    lang.should.equal('es')
    const { lang: lang2 } = sanitize(req, res, configs)
    lang2.should.equal('es')
  })

  it('should allow to have null values', async () => {
    const req = { method: 'POST', query: {}, body: { value: null } }
    const res = {}
    const configs = { value: { canBeNull: true } }
    const { value } = sanitize(req, res, configs)
    should(value).be.Null()
  })

  describe('optional parameters', () => {
    it('should accept optional parameters', async () => {
      const req = { query: {} }
      const res = {}
      const configs = { ids: { optional: true } }
      const input = sanitize(req, res, configs)
      Object.keys(input).length.should.equal(0)
    })

    it('should still validate optional parameters', async () => {
      const req = { query: { lang: '1212515' } }
      const res = {}
      const configs = { lang: { optional: true } }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid lang: 1212515')
      }
    })
  })

  describe('secret parameter', () => {
    it('should not return the value', async () => {
      const req = { query: { password: 'a' } }
      const configs = { password: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.context.value.should.equal('*')
      }
    })
  })

  describe('generic parameter', () => {
    it('should accept boolean generic parameters', async () => {
      const req = { query: { 'include-users': true } }
      const res = {}
      const configs = {
        'include-users': {
          generic: 'boolean',
          default: false,
        },
      }
      const { includeUsers } = sanitize(req, res, configs)
      includeUsers.should.be.true()
    })

    it('should accept allowlist generic parameters', async () => {
      const res = {}
      const configs = {
        foo: {
          generic: 'allowlist',
          allowlist: [ 'a', 'b', 'c' ],
        },
      }
      const { foo } = sanitize({ query: { foo: 'a' } }, res, configs)
      foo.should.equal('a')
      try {
        sanitize({ query: { foo: 'd' } }, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid foo')
      }
    })

    it('should reject non-string allowlist value', async () => {
      const req = { method: 'POST', query: {}, body: { attributes: 123 } }
      const res = {}
      const configs = {
        attributes: {
          allowlist: [ 'foo' ],
        },
      }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid attributes')
      }
    })

    it('should reject non-string array-wrapped allowlist value', async () => {
      const req = { method: 'POST', query: {}, body: { attributes: [ 123 ] } }
      const res = {}
      const configs = {
        attributes: {
          allowlist: [ 'foo' ],
        },
      }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid attributes')
      }
    })

    it('should clone default values', async () => {
      const req = { query: {} }
      const res = {}
      const obj = {}
      const configs = {
        foo: {
          generic: 'object',
          default: obj,
        },
      }
      const { foo } = sanitize(req, res, configs)
      foo.should.deepEqual({})
      foo.should.not.equal(obj)
    })

    it('should accept an ignored generic parameters', async () => {
      const res = {}
      const configs = {
        foo: {
          generic: 'ignore',
        },
      }
      const { foo } = sanitize({ query: { foo: 'a' } }, res, configs)
      should(foo).not.be.ok()
      should(res.warnings).not.be.ok()
    })
  })

  describe('strictly positive integer', () => {
    it('should accept string values', async () => {
      const req = { query: { limit: '5' } }
      const configs = { limit: {} }
      const { limit } = sanitize(req, {}, configs)
      limit.should.equal(5)
    })

    it('should accept a default value', async () => {
      const req = { query: {} }
      const configs = { limit: { default: 100 } }
      const { limit } = sanitize(req, {}, configs)
      limit.should.equal(100)
    })

    it('should accept a max value', async () => {
      const req = { query: { limit: 1000 } }
      const res = {}
      const configs = { limit: { max: 500 } }
      const { limit } = sanitize(req, res, configs)
      limit.should.equal(500)
      res.warnings.should.be.an.Object()
      res.warnings.should.deepEqual([
        "limit can't be over 500",
      ])
    })

    it('should reject negative values', async () => {
      const req = { query: { limit: '-5' } }
      const configs = { limit: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid limit: -5')
      }
    })

    it('should reject non-integer values', async () => {
      const req = { query: { limit: '5.5' } }
      const configs = { limit: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid limit: 5.5')
      }
    })

    it('should reject non-number values', async () => {
      const req = { query: { limit: 'bla' } }
      const configs = { limit: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid limit: bla')
      }
    })
  })

  describe('couch uuid', () => {
    it('should reject invalid uuids values', async () => {
      const req = { query: { user: 'foo' } }
      const configs = { user: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid user: foo')
      }
    })

    it('should accept valid uuids', async () => {
      const req = { query: { user: '00000000000000000000000000000000' } }
      const configs = { user: {} }
      const { user, userId } = sanitize(req, {}, configs)
      user.should.equal('00000000000000000000000000000000')
      userId.should.equal('00000000000000000000000000000000')
    })
  })

  describe('string with specific length', () => {
    it('should reject a token of invalid type', async () => {
      const req = { query: { token: 1251251 } }
      const configs = { token: { length: 32 } }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid token: expected string, got number')
      }
    })

    it('should reject an invalid token', async () => {
      const req = { query: { token: 'foo' } }
      const configs = { token: { length: 32 } }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid token length: expected 32, got 3')
      }
    })
  })

  describe('objects', () => {
    it('should stringify invalid values', async () => {
      const req = { query: { foo: [ 123 ] } }
      const configs = { foo: { generic: 'object' } }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid foo: [123]')
      }
    })
  })

  describe('uris', () => {
    it('should reject invalid type', async () => {
      const req = { query: { uris: 1251251 } }
      const configs = { uris: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid uris: expected array, got number')
      }
    })

    it('should reject array including invalid values', async () => {
      const req = { query: { uris: [ 1251251 ] } }
      const configs = { uris: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid uri: expected uri, got')
      }
    })

    it('should accept uris as an array of strings', async () => {
      const req = { query: { uris: [ 'wd:Q535', 'isbn:9782330056315' ] } }
      const configs = { uris: {} }
      const { uris } = sanitize(req, {}, configs)
      uris.should.deepEqual(req.query.uris)
    })

    it('should accept uris as a pipe separated string', async () => {
      const req = { query: { uris: 'wd:Q535|isbn:9782330056315' } }
      const configs = { uris: {} }
      const { uris } = sanitize(req, {}, configs)
      uris.should.deepEqual(req.query.uris.split('|'))
    })
  })

  describe('uri', () => {
    it('should reject invalid type', async () => {
      const req = { query: { uri: 1251251 } }
      const configs = { uri: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid uri')
      }
    })
  })

  describe('ids', () => {
    it('should reject invalid type', async () => {
      const req = { query: { ids: 1251251 } }
      const configs = { ids: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid ids: expected array, got number')
      }
    })

    it('should reject array including invalid values', async () => {
      const req = { query: { ids: [ 1251251 ] } }
      const configs = { ids: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid id: expected id, got')
      }
    })

    it('should deduplicate ids', async () => {
      const id = '5ac0fc497813d9817047e0b89301e502'
      const req = { query: { ids: [ id, id ] } }
      const configs = { ids: {} }
      const { ids } = sanitize(req, {}, configs)
      ids.should.deepEqual([ id ])
    })

    it('should reject an empty array', async () => {
      const req = { query: { ids: [] } }
      const configs = { ids: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith("ids array can't be empty")
      }
    })
  })

  describe('lang', () => {
    it("should default to 'en'", async () => {
      const req = { query: {} }
      const res = {}
      const configs = { lang: {} }
      const { lang } = sanitize(req, res, configs)
      lang.should.equal('en')
    })

    it('should accept a valid lang', async () => {
      const req = { query: { lang: 'fr' } }
      const res = {}
      const configs = { lang: {} }
      const { lang } = sanitize(req, res, configs)
      lang.should.equal('fr')
    })

    it('should reject an invalid lang', async () => {
      const req = { query: { lang: '12512' } }
      const res = {}
      const configs = { lang: {} }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('invalid lang: 12512')
      }
    })
  })

  describe('relatives', () => {
    it('should reject non allowlisted relatives', async () => {
      const req = { query: { relatives: [ 'bar', 'foo' ] } }
      const res = {}
      const configs = { relatives: { allowlist: [ 'bar' ] } }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid relative')
      }
    })

    it('should return relatives if allowlisted', async () => {
      const req = { query: { relatives: [ 'bar', 'foo' ] } }
      const res = {}
      const configs = { relatives: { allowlist: [ 'foo', 'bar' ] } }
      const { relatives } = sanitize(req, res, configs)
      relatives.should.deepEqual([ 'bar', 'foo' ])
    })
  })

  describe('nonEmptyString parameters', () => {
    it('should trim value', async () => {
      const req = { query: { name: ' f oo ' } }
      const res = {}
      const configs = { name: {} }
      const { name } = sanitize(req, res, configs)
      name.should.deepEqual('f oo')
    })

    it('should throw on empty value', async () => {
      const req = { query: {} }
      const res = {}
      const configs = { name: {} }
      try {
        sanitize(req, res, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('missing parameter in query: name')
      }
    })
  })

  describe('bbox', () => {
    it('should reject an incomplete bbox', async () => {
      const req = { query: { bbox: '[0, 0, 1]' } }
      const configs = { bbox: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid bbox')
      }
    })

    it('should reject bbox with a higher minLng than maxLng', async () => {
      const req = { query: { bbox: '[0, 2, 1, 1]' } }
      const configs = { bbox: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid bbox')
      }
    })

    it('should reject bbox with a higher minLat than maxLat', async () => {
      const req = { query: { bbox: '[2, 0, 1, 1]' } }
      const configs = { bbox: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.startWith('invalid bbox')
      }
    })

    it('should parse a valid bbox', async () => {
      const req = { query: { bbox: '[0, 0, 1, 1]' } }
      const configs = { bbox: {} }
      const { bbox } = sanitize(req, {}, configs)
      bbox.should.deepEqual([ 0, 0, 1, 1 ])
    })
  })

  describe('parameter prefixed aliases', () => {
    it('should allow to use parameter aliases ', async () => {
      const req = { query: { 'new-password': '12345678', 'old-password': '12345678' } }
      const configs = { 'new-password': {}, 'old-password': {} }
      sanitize(req, {}, configs)
    })

    it('should reject an alias used instead of the primary parameter name', async () => {
      const req = { query: { 'new-password': '12345678' } }
      const configs = { password: {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('missing parameter in query: password')
      }
    })

    it('should reject a primary paramer named used instead of an alias', async () => {
      const req = { query: { password: '12345678' } }
      const configs = { 'new-password': {} }
      try {
        sanitize(req, {}, configs)
        shouldNotBeCalled()
      } catch (err) {
        err.message.should.equal('missing parameter in query: new-password')
      }
    })
  })

  describe('parameter renaming', () => {
    it('should set ids aliases', () => {
      const userId = 'f14b868c7e99c56252e592e1485c6125'
      const req = { query: { user: userId } }
      const configs = { user: {} }
      const params = sanitize(req, {}, configs)
      params.userId.should.equal(userId)
      should(params.userAcct).not.be.ok()
    })

    it('should rename based on config', () => {
      const userAcct = 'f14b868c7e99c56252e592e1485c6125@localhost:3009'
      const req = { query: { user: userAcct } }
      const configs = { user: { type: 'acct' } }
      const params = sanitize(req, {}, configs)
      params.userAcct.should.equal(userAcct)
      should(params.userId).not.be.ok()
    })
  })
})

describe('validateSanitization', () => {
  it('should reject an unknown parameter', async () => {
    try {
      validateSanitization({ foo: {} })
      shouldNotBeCalled()
    } catch (err) {
      err.message.should.equal('invalid parameter name')
      err.context.name.should.equal('foo')
      err.statusCode.should.equal(500)
    }
  })

  it('should reject an invalid generic name', async () => {
    try {
      validateSanitization({ foo: { generic: 'bar' } })
      shouldNotBeCalled()
    } catch (err) {
      err.message.should.equal('invalid generic name')
      err.context.name.should.equal('foo')
      err.context.generic.should.equal('bar')
      err.statusCode.should.equal(500)
    }
  })

  it('should accept a known parameter', async () => {
    validateSanitization({ ids: {} })
  })

  it('should accept a valid generic name', async () => {
    validateSanitization({ foo: { generic: 'boolean' } })
  })
})
