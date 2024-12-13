import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { request, type RequestOptions } from '#lib/requests'
import type { AbsoluteUrl, HttpMethod } from '#types/common'

export async function federatedRequest <Response = unknown> (method: HttpMethod, url: AbsoluteUrl, options: RequestOptions = {}) {
  try {
    const res = await request(method, url, options)
    return res as Response
  } catch (err) {
    throw forwardRemoteError(err, url)
  }
}

function forwardRemoteError (err: ContextualizedError, remoteUrl: AbsoluteUrl) {
  if (!('body' in err)) throw err
  const { statusCode } = err
  // @ts-expect-error
  const { status_verbose: message, context } = err.body
  const repackedError = newError(message, statusCode, context)
  repackedError.forwardedFrom = remoteUrl
  return repackedError
}
