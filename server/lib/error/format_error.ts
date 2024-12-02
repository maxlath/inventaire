// Using minimal dependencies to avoid circular dependencies
// as this is depended on by lib/error which is called very early

import type { AbsoluteUrl } from '#types/common'

// Global conventions:
// - all error objects should have a statusCode (mimicking HTTP status codes)
//   this is already the case for errors rejected by the lib blue-cot and server/lib/requests

export type ErrorContext = Record<string, unknown>

export interface ContextualizedError extends Error {
  code?: string
  context?: ErrorContext
  privateContext?: ErrorContext
  emitter?: string
  notFound?: boolean
  statusCode?: number
  retryAfter?: number
  type?: string
  attachReqContext?: string
  error_type?: string
  error_name?: string
  mute?: boolean
  body?: unknown
  referer?: string
  forwardedFrom?: AbsoluteUrl
}

export function formatContextualizedError (err: ContextualizedError, filter: number | string, context?: ErrorContext) {
  // numbers filters are used as HTTP codes
  // while string will be taken as a type
  if (typeof filter === 'number') {
    err.statusCode = filter
  } else {
    err.type = filter
  }
  err.context = context
  err.emitter = getErrorEmittingLines(err)

  return err
}

function getErrorEmittingLines (err) {
  return err.stack.split('\n')
  .filter(line => !line.match(/lib\/error/))
  .slice(0, 5)
  .map(getErrorEmittingLine)
}

function getErrorEmittingLine (line) {
  if (!line) return
  if (!line.trim().startsWith('at ')) return line
  return line
  .trim()
  .replace(/^\s*at\s+/, '')
  // delete parenthesis around the file path
  .replace(/(\(|\))/g, '')
  // delete machine specific path
  .replace(/[a-z_/]+server/, ': server')
  .replace(/[a-z_/]+node_modules/, ': node_modules')
  // identify anonymous functions
  .replace(/^:/, '(anonymous):')
}

export function iscontextualizedError (err): err is ContextualizedError {
  return typeof err?.emitter === 'string' || err?.context != null
}
