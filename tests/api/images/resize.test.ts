import 'should'
import { getHashCode } from '#lib/utils/base'
import { uploadSomeImage } from '#tests/api/utils/images'
import { rawRequest } from '#tests/api/utils/request'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { RelativeUrl } from '#types/common'

describe('images:resize', () => {
  it('should return a resized local image', async () => {
    const { hash } = await uploadSomeImage({ container: 'users', preventAutoRemove: true })
    const { statusCode, headers, body } = await rawRequest('get', `/img/users/10x10/${hash}`)
    statusCode.should.equal(200)
    headers['content-type'].should.equal('image/jpeg')
    body.length.should.be.below(1000)
  })

  // Requires config.remoteImages.useEntitiesHostCachedImages = false
  xit('should return a resized remote image from a trusted domain', async () => {
    const remoteUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Linet%2C%20martha.jpg?width=100'
    const urlHash = getHashCode(remoteUrl)
    const url: RelativeUrl = `/img/remote/10x10/${urlHash}?href=${encodeURIComponent(remoteUrl)}`
    const { statusCode, headers, body } = await rawRequest('get', url)
    statusCode.should.equal(200)
    headers['content-type'].should.equal('image/jpeg')
    body.length.should.be.below(1000)
  })

  it('should deny resizing an image from a non-trusted domain', async () => {
    const remoteUrl = 'https://some.domain.com/image.jpg'
    const urlHash = getHashCode(remoteUrl)
    const url: RelativeUrl = `/img/remote/10x10/${urlHash}?href=${encodeURIComponent(remoteUrl)}`
    await rawRequest('get', url)
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      JSON.parse(err.body).status_verbose.should.equal('image domain not allowed')
    })
  })

  // Requires config.remoteImages.useEntitiesHostCachedImages = false
  xit('should return a resized remote image from a trusted domain', async () => {
    const remoteUrl = 'https://static.mamot.fr/accounts/avatars/000/066/589/original/7234e39fa914ed2b.jpg'
    const urlHash = getHashCode(remoteUrl)
    const url: RelativeUrl = `/img/remote/10x10/${urlHash}?href=${encodeURIComponent(remoteUrl)}`
    const { statusCode, headers, body } = await rawRequest('get', url)
    statusCode.should.equal(200)
    headers['content-type'].should.equal('image/jpeg')
    body.length.should.be.below(1000)
  })
})
