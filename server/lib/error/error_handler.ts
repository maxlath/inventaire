import { pick } from 'lodash-es'
import { isAuthentifiedReq } from '#lib/boolean_validations'
import type { ContextualizedError } from '#lib/error/format_error'
import { responses_ } from '#lib/responses'
import { objLength } from '#lib/utils/base'
import { warn, logError } from '#lib/utils/logs'
import { typeOf } from '#lib/utils/types'
import type { Req, Res } from '#types/server'
import type { User } from '#types/user'

const headersToKeep = [ 'user-agent', 'content-type', 'content-length', 'referer' ] as const
const loggedUserAttributes = [ '_id', 'username' ] as const

interface ErrorResponse extends ContextualizedError {
  user?: Pick<User, typeof loggedUserAttributes[number]>
  headers?: Pick<Req['headers'], typeof headersToKeep[number]>
}

export function errorHandler (req: Req, res: Res, err: ErrorResponse) {
  // only accepts Error instances
  if (!(err instanceof Error)) {
    logError(err, 'bad error object')
    res.status(500).send(err)
    return
  }

  // if a status code was attached to the error, use it
  const statusCode = err.statusCode || 500

  if (isAuthentifiedReq(req)) {
    err.user = pick(req.user, loggedUserAttributes)
  }
  err.headers = pick(req.headers, headersToKeep)

  // Ex: to pass req.query as err.context, set err.attachReqContext = 'query'
  err.attachReqContext = err.attachReqContext || 'body'
  if (emptyContext(err.context)) {
    err.context = pick(req, err.attachReqContext)
  }
  delete err.attachReqContext

  if (err.mute !== true) {
    if (statusCode.toString().startsWith('4')) {
      let label = statusCode.toString()
      if (err.forwardedFrom) label = `[forwarded error] ${label}`
      warn(err, label)
    } else {
      let label = err.message
      if (err.forwardedFrom) label = `[forwarded error] ${label}`
      logError(err, label)
    }
  }

  if (err.context) {
    // Prevent returning authorization headers from an internal requests that would have failed
    // such as requests to CouchDB
    delete err.context.headers
  }

  res.status(statusCode)
  responses_.send(res, {
    status: statusCode,
    status_verbose: err.message,
    error_type: err.error_type,
    error_name: err.error_name,
    context: err.context,
  })
}

function emptyContext (context) {
  if (context == null) return true
  const type = typeOf(context)
  if (type === 'array' || type === 'string') return context.length === 0
  else if (type === 'object') return objLength(context) === 0
  else return true
}
