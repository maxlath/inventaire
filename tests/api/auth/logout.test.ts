import 'should'
import config from '#server/config'
import { parseSessionCookies, parseBase64EncodedJson } from '#tests/api/utils/auth'
import { rawRequest } from '#tests/api/utils/request'
import { getUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'
import type { AbsoluteUrl } from '#types/common'

const origin = config.getLocalOrigin()
const endpoint = `${origin}/api/auth?action=logout` as AbsoluteUrl
const authentifiedEndpoint = `${origin}/api/user` as AbsoluteUrl

describe('auth:logout', () => {
  it('should logout and unable to access an authentified endpoint', async () => {
    const user = await getUser()
    const [ sessionCookie, signatureCookie ] = parseSessionCookies(user.cookie)
    parseBase64EncodedJson(sessionCookie).passport.user.should.equal(user._id)
    const { headers } = await rawRequest('post', endpoint, {
      headers: {
        cookie: user.cookie,
      },
    })
    const [ sessionCookieAfterLogout, signatureCookieAfterLogout ] = parseSessionCookies(headers['set-cookie'])
    parseBase64EncodedJson(sessionCookieAfterLogout).passport.should.deepEqual({})
    signatureCookieAfterLogout.should.not.equal(signatureCookie)
    await rawRequest('get', authentifiedEndpoint, {
      headers: {
        cookie: headers['set-cookie'],
      },
    })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(401)
    })
  })
})
