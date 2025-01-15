import 'should'
import { multipartFormContentType } from '#controllers/images/lib/parse_form'
import { isImageHash } from '#lib/boolean_validations'
import { buildUrl } from '#lib/utils/url'
import { uploadSomeImage } from '#tests/api/utils/images'
import { authReq } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

function postForm (container: string) {
  const url = buildUrl('/api/images', { action: 'upload', container })
  return authReq('post', url, null, { 'content-type': multipartFormContentType })
}

describe('images:upload', () => {
  // Uploads on the assets container are done directly by an instance admin
  // without passing by this endpoint
  it('reject uploads on assets container', async () => {
    await postForm('assets')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid container')
    })
  })

  // `remote` is a pseudo-container known by the /img endpoint,
  // but it's not a real object storage container: source files
  // aren't fetched from the object storage but from remote URLs
  it('reject uploads on remote container', async () => {
    await postForm('remote')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid container')
    })
  })

  it('reject uploads on an unknown container', async () => {
    await postForm('foo')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('invalid container')
    })
  })

  it('should accept uploads on entities container', async () => {
    await postForm('entities')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('no file provided')
    })
  })

  it('should accept uploads on users container', async () => {
    await postForm('users')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('no file provided')
    })
  })

  it('should accept uploads on groups container', async () => {
    await postForm('groups')
    .then(shouldNotBeCalled)
    .catch(err => {
      err.body.status_verbose.should.startWith('no file provided')
    })
  })

  it('should upload an image', async () => {
    const container = 'entities'
    const { statusCode, url } = await uploadSomeImage({ container })
    statusCode.should.equal(200)
    url.should.startWith(`/img/${container}/`)
    const imageHash = url.split('/')[3]
    isImageHash(imageHash).should.be.true()
  })
})
