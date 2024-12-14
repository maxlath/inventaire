import { prepareFormParse } from '#controllers/images/lib/parse_form'
import type { Middleware, PathSpecificMiddleware } from '#types/server'
import auth from './auth.js'
import { acceptUrlencoded, jsonBodyParser, deduplicateRequests } from './content.js'
import requestsLogger from './requests_logger.js'
import security from './security.js'
import { favicon, mountStaticFiles } from './statics.js'

export const middlewares: (Middleware | PathSpecificMiddleware)[] = [
  // Place the request logger first so that even requests that generate an error
  // in the middleware are logged
  requestsLogger,

  security.setCorsPolicy,

  [ '/api/images', prepareFormParse ],

  // server/controllers/auth/fake_submit.ts relies on the possibility
  // to submit a url encoded form data, so it needs to have the body-parser ready for it
  acceptUrlencoded('/api/submit'),

  // OAuth clients might send urlencoded content
  acceptUrlencoded('/api/oauth/token'),

  jsonBodyParser,
  favicon,
  mountStaticFiles,

  auth.cookieParser,
  auth.session,
  auth.enforceSessionMaxAge,
  auth.passport.initialize,
  auth.passport.session,
  auth.authorizationHeader,

  deduplicateRequests,
]
