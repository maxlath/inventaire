import should from 'should'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { getSomeRemoteEditionWithALocalImage, getSomeWdEditionUri, getSomeWdEditionUriWithoutLocalLayer, someImageHash, someRandomImageHash } from '#fixtures/entities'
import { validateP31Update } from '#lib/wikidata/validate_wd_update'
import { addClaim, getByUri, removeClaim, updateClaim } from '#tests/api/utils/entities'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { SimplifiedClaims } from '#types/entity'

describe('entities:update-claims:wd', () => {
  describe('validateP31Update', () => {
    it('should reject removing the last typing P31', () => {
      try {
        const claims = { 'wdt:P31': [ 'wd:Q5' ] } satisfies SimplifiedClaims
        validateP31Update(claims, 'wd:Q5', null)
        shouldNotBeCalled()
      } catch (err) {
        err.statusCode.should.equal(400)
        err.message.should.containEql("wdt:P31 array can't be empty")
      }
    })

    // This should be covered by validateWdEntityUpdate call to validateClaimValueSync
    // it('should reject changing type by changing the P31 value', () => {})

    it('should reject changing type by removing an extra value', () => {
      try {
        const claims = { 'wdt:P31': [ 'wd:Q3331189', 'wd:Q47461344' ] } satisfies SimplifiedClaims
        validateP31Update(claims, 'wd:Q3331189', null)
        shouldNotBeCalled()
      } catch (err) {
        err.statusCode.should.equal(400)
        err.message.should.containEql("This edit would change the entity's type")
      }
    })
  })

  describe('update local layer', () => {
    it('should add a local property claim', async () => {
      const uri = await getSomeWdEditionUriWithoutLocalLayer()
      const imageHash = someRandomImageHash()
      await addClaim({ uri, property: 'invp:P2', value: imageHash })
      const updatedEdition = await getByUri(uri)
      updatedEdition.claims['invp:P2'][0].should.equal(imageHash)
    })

    it('should update a local property claim', async () => {
      const { uri, claims } = await getSomeRemoteEditionWithALocalImage()
      const imageHashA = getFirstClaimValue(claims, 'invp:P2')
      const imageHashB = someRandomImageHash()
      await updateClaim({ uri, property: 'invp:P2', oldValue: imageHashA, newValue: imageHashB })
      const updatedEdition = await getByUri(uri)
      updatedEdition.claims['invp:P2'][0].should.equal(imageHashB)
    })

    it('should delete a local property claim', async () => {
      const { uri, claims } = await getSomeRemoteEditionWithALocalImage()
      const imageHash = getFirstClaimValue(claims, 'invp:P2')
      await removeClaim({ uri, property: 'invp:P2', value: imageHash })
      const updatedEdition = await getByUri(uri)
      should(updatedEdition.claims['invp:P2']).not.be.ok()
    })

    it('should reject invp:P1 updates (with no layer existing)', async () => {
      const uri = await getSomeWdEditionUri()
      await addClaim({ uri, property: 'invp:P1', value: 'wd:Q1' })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('entity local layer linking property (invp:P1) can not be updated')
      })
    })

    it('should reject invp:P1 updates (with an existing layer)', async () => {
      const { uri } = await getSomeRemoteEditionWithALocalImage()
      await updateClaim({ uri, property: 'invp:P1', oldValue: uri, newValue: 'wd:Q1' })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('entity local layer linking property (invp:P1) can not be updated')
      })
    })

    it('should reject invalid local claim updates', async () => {
      const remoteWorkUri = 'wd:Q18120925'
      await addClaim({ uri: remoteWorkUri, property: 'invp:P2', value: someImageHash })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal("works can't have a property invp:P2")
      })
    })
  })
})
