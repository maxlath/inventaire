// Pre-formatted error handlers to make error responses consistent
import { pick } from 'lodash-es'
import { isAuthentifiedReq } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { errorHandler } from '#lib/error/error_handler'
import type { ErrorContext } from '#lib/error/format_error'
import { typeOf } from '#lib/utils/types'
import type { Req, Res } from '#types/server'

// A standardized way to return a 400 missing parameter
// either in the request query or body
export function newMissingError (place: string, parameter: string) {
  // Allow to pass several possible parameters separated by pipes
  // Ex: 'user|username'
  parameter = parameter.split('|').join(' or ')
  const message = `missing parameter in ${place}: ${parameter}`
  const err = newError(message, 400)
  err.attachReqContext = place
  err.error_type = 'missing_parameter'
  err.error_name = `missing_${parameter}`
  return err
}

// A standardized way to return a 400 invalid parameter
export function newInvalidError (parameter: string, value: unknown) {
  const type = typeOf(value)
  const context = { parameter, value, type }
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : value
  const err = newError(`invalid ${parameter}: ${valueStr}`, 400, context)
  err.error_type = 'invalid_parameter'
  err.error_name = `invalid_${parameter}`
  return err
}

export const newMissingQueryError = newMissingError.bind(null, 'query')
export const newMissingBodyError = newMissingError.bind(null, 'body')

export function newUnauthorizedApiAccessError (statusCode: 401 | 403, context?: ErrorContext) {
  return newError('unauthorized api access', statusCode, context)
}

const Bundle = newErrorFn => (req: Req, res: Res, ...args) => {
  // First create the new error
  const err = newErrorFn(...args)
  // then make the handler deal with the res object
  return errorHandler(req, res, err)
}

export const bundleError = Bundle(newError)
export const bundleMissingQueryError = Bundle(newMissingQueryError)
export const bundleMissingBodyError = Bundle(newMissingBodyError)
export const bundleInvalidError = Bundle(newInvalidError)

export function bundleUnauthorizedApiAccess (req: Req, res: Res, context?: ErrorContext) {
  const statusCode = isAuthentifiedReq(req) ? 403 : 401
  const err = newUnauthorizedApiAccessError(statusCode, context)
  return errorHandler(req, res, err)
}

// A standardized way to return a 400 unknown action
export function bundleUnknownAction (req: Req, res: Res, context?) {
  if (context == null) {
    context = pick(req, [ 'method', 'query', 'body' ])
    context.url = req.originalUrl
  }
  return bundleError(req, res, 'unknown action', 400, context)
}
