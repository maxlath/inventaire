import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import type { AbsoluteUrl } from '#types/common'

export function forwardRemoteError (err: ContextualizedError, remoteUrl: AbsoluteUrl) {
  if (!('body' in err)) throw err
  const { statusCode } = err
  // @ts-expect-error
  const { status_verbose: message, context } = err.body
  const repackedError = newError(message, statusCode, context)
  repackedError.forwardedFrom = remoteUrl
  return repackedError
}
