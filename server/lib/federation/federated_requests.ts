import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { request, type RequestOptions } from '#lib/requests'
import config from '#server/config'
import type { AbsoluteUrl, HttpMethod, RelativeUrl } from '#types/common'

const { remoteEntitiesOrigin } = config.federation

export async function federatedRequest <Response = unknown> (method: HttpMethod, url: RelativeUrl, options: RequestOptions = {}) {
  const remoteUrl = `${remoteEntitiesOrigin}${url}` as AbsoluteUrl
  try {
    const res = await request(method, remoteUrl, options)
    return res as Response
  } catch (err) {
    throw forwardRemoteError(err, remoteUrl)
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
