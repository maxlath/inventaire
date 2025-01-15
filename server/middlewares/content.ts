import bodyParser from 'body-parser'
import parseUrl from 'parseurl'
import { bundleError } from '#lib/error/pre_filled'
import { httpMethodHasBody } from '#lib/requests'
import { getHashCode } from '#lib/utils/base'
import { log } from '#lib/utils/logs'
import config from '#server/config'

const { deduplicateRequests: dedupRequests } = config
const { logBody: logIncomingRequestsBody } = config.incomingRequests

const urlencodedBodyParser = bodyParser.urlencoded({ extended: false })

// Assume JSON content-type for, among others:
// - application/json
// - application/x-www-form-urlencoded (used by /bin/curl and jquery default)
// - application/csp-report
// While thus not parse properly urlencoded content, preserving from CSRF attacks
// cf https://fosterelli.co/dangerous-use-of-express-body-parser
// Not using '*/*' as this would include multipart/form-data
// used for image upload
export const jsonBodyParser = bodyParser.json({ type: 'application/*', limit: '5mb' })

export const acceptUrlencoded = endpoint => [ endpoint, urlencodedBodyParser ]

// Assumes that a request made twice with the same body within 2 seconds
// is an erronous request that should be blocked
export function deduplicateRequests (req, res, next) {
  if (!dedupRequests) return next()

  const { method, url } = req
  if (!httpMethodHasBody(method)) return next()

  const { pathname } = parseUrl(req)
  if (ignorePathname.includes(pathname)) return next()

  // If the request as no session cookie, simply use a hash of the header
  // Different users might have the same but users using Basic Auth will be distincts
  // so it only let unauthentified POST/PUT requests with the exact same body at risk
  // of unjustified request denial, which should be a rather small risk
  const sessionId = (req.cookies && req.cookies['express:sess.sig']) || headersHash(req)

  // Known case with an empty body:
  // - image upload: its using application/octet-stream header instead of json
  //   thus body-parser won't populate req.body
  const data = getHashCode(JSON.stringify(req.body || {}))

  const key = `${sessionId}:${method}:${url}`
  const previousData = requestsCache[key]

  if (data === previousData) {
    return bundleError(req, res, 'duplicated request', 429, [ key, req.body ])
  }

  temporaryLock(key, data)

  if (logIncomingRequestsBody) {
    const userAgent = req.headers['user-agent']
    log(req.body, `${method}:${url} body [${userAgent}]`)
  }

  next()
}

const headersHash = req => getHashCode(JSON.stringify(req.headers))

function temporaryLock (key, data) {
  requestsCache[key] = data
  // Unlock after 2 secondes
  const unlock = () => { requestsCache[key] = null }
  setTimeout(unlock, 2000)
}

// can be problematic in cluster mode as it won't be shared between instances
const requestsCache = {}

const ignorePathname = [
  '/api/reports',
]
