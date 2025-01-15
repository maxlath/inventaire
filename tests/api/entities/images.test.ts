import should from 'should'
import { getUrlFromEntityImageHash } from '#controllers/entities/lib/entities'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import {
  createEdition,
  createEditionWithIsbn,
  createCollection,
  createSerie,
  createWork,
  someImageHash,
  getSomeRemoteEditionWithALocalImage,
} from '#fixtures/entities'
import { fixedEncodeURIComponent } from '#lib/utils/url'
import config, { federatedMode } from '#server/config'
import { rawRequest } from '#tests/api/utils/request'
import { publicReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const origin = config.getPublicOrigin()
const { remoteEntitiesOrigin } = config.federation
const encodedCommonsUrlChunk = fixedEncodeURIComponent('https://commons.wikimedia.org/wiki/Special:FilePath/')

describe('entities:images', () => {
  it('should return an array of images associated with the passed uri', async () => {
    const uri = 'wd:Q535'
    const res = await publicReq('get', `/api/entities?action=images&uris=${uri}`)
    res.images.should.be.an.Object()
    const imagesRes = res.images[uri]
    imagesRes.should.be.an.Object()
    imagesRes.claims.should.be.a.Array()
    imagesRes.claims.length.should.equal(1)
  })

  it('should reject redirect requests with multiple URIs', async function () {
    if (federatedMode) this.skip()
    await publicReq('get', '/api/entities?action=images&uris=wd:Q535|wd:Q42&redirect=true')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
    })
  })

  it('should redirect to the image if requested in options', async function () {
    if (federatedMode) this.skip()
    const url = '/api/entities?action=images&uris=wd:Q535&redirect=true&width=32'
    const { statusCode, headers } = await rawRequest('get', url)
    statusCode.should.equal(302)
    headers.location.should.startWith(`${origin}/img/remote/32x1600/`)
    headers.location.should.containEql(`href=${encodedCommonsUrlChunk}`)
  })

  it('should redirect to the image if requested in options [federated mode]', async function () {
    if (!federatedMode) this.skip()
    const url = '/api/entities?action=images&uris=wd:Q535&redirect=true&width=32'
    const { statusCode, headers } = await rawRequest('get', url)
    statusCode.should.equal(302)
    headers.location.should.equal(`${remoteEntitiesOrigin}${url}`)
  })

  describe('inventaire:entities', () => {
    it('should return images from isbn based uris', async () => {
      const { uri } = await createEditionWithIsbn({ claims: { 'invp:P2': [ someImageHash ] } })
      const res = await publicReq('get', `/api/entities?action=images&uris=${uri}`)
      const imagesRes = res.images[uri]
      imagesRes.should.be.an.Object()
      imagesRes.claims.should.be.a.Array()
      imagesRes.claims.length.should.equal(1)
    })

    it('should return images from inventaire work', async () => {
      const edition = await createEdition()
      const workUri = edition.claims['wdt:P629'][0]
      const res = await publicReq('get', `/api/entities?action=images&uris=${workUri}`)
      const imagesRes = res.images[workUri]
      imagesRes.claims.should.deepEqual([])
      imagesRes.en.length.should.equal(1)
    })

    it('should prefer images from mono-work editions to illustrate works', async () => {
      const [ workA, workB ] = await Promise.all([ createWork(), createWork() ])
      const imageHashX = '1aaaaaaaaabbbbbbbbbbccccccccccdddddddddd'
      const imageHashY = '2aaaaaaaaabbbbbbbbbbccccccccccdddddddddd'
      const imageHashZ = '3aaaaaaaaabbbbbbbbbbccccccccccdddddddddd'
      await Promise.all([
        createEdition({ works: [ workA, workB ], image: imageHashX }),
        createEdition({ works: [ workA ], image: imageHashY }),
        createEdition({ works: [ workA ], image: imageHashZ }),
      ])
      const res = await publicReq('get', `/api/entities?action=images&uris=${workA.uri}|${workB.uri}`)
      const workAImage = res.images[workA.uri].en[0]
      should(workAImage === getUrlFromEntityImageHash(imageHashY) || workAImage === getUrlFromEntityImageHash(imageHashZ)).be.true()
      const workBImage = res.images[workB.uri].en[0]
      workBImage.should.equal(getUrlFromEntityImageHash(imageHashX))
    })

    it('should return images from inventaire collection', async () => {
      const { uri } = await createCollection()
      await createEdition({ claims: { 'wdt:P195': [ uri ] } })
      const res = await publicReq('get', `/api/entities?action=images&uris=${uri}`)
      const imagesRes = res.images[uri]
      imagesRes.en.length.should.equal(1)
    })

    it('should return images from inventaire serie', async () => {
      const { uri } = await createSerie()
      const work = await createWork({ claims: { 'wdt:P179': [ uri ] } })
      await createEdition({ work })
      const res = await publicReq('get', `/api/entities?action=images&uris=${uri}`)
      const imagesRes = res.images[uri]
      imagesRes.en.length.should.equal(1)
    })

    it('should return images from wikidata editions local layers for editions', async () => {
      const { uri, claims } = await getSomeRemoteEditionWithALocalImage()
      const imageHash = getFirstClaimValue(claims, 'invp:P2')
      const res = await publicReq('get', `/api/entities?action=images&uris=${uri}`)
      // There might also be wd image file names, typically from wdt:P18 claims
      res.images[uri].claims.should.containEql(getUrlFromEntityImageHash(imageHash))
    })

    it('should return images from wikidata editions local layers for works [flaky]', async () => {
      const edition = await getSomeRemoteEditionWithALocalImage()
      const { originalLang, claims } = edition
      const imageHash = getFirstClaimValue(claims, 'invp:P2')
      const workUri = getFirstClaimValue(claims, 'wdt:P629')
      const { images } = await publicReq('get', `/api/entities?action=images&uris=${workUri}`)
      images[workUri][originalLang].should.containEql(getUrlFromEntityImageHash(imageHash))
    })
  })
})
