import { cleanupImageUrl } from '#data/dataseed/dataseed'
import { isUrl } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { signedFederatedRequest } from '#lib/federation/signed_federated_request'
import { isPrivateUrl } from '#lib/network/is_private_url'
import { assertString } from '#lib/utils/assert_types'
import { log } from '#lib/utils/logs'
import config, { federatedMode } from '#server/config'
import type { AbsoluteUrl } from '#types/common'
import type { ImageContainer } from '#types/image'
import type { AuthentifiedReq } from '#types/server'
import convertImageUrl, { type ImportedImage } from './convert_image_url.js'

const { enabled: dataseedEnabled } = config.dataseed

export async function convertAndCleanupImageUrl ({ container, url }: { container: ImageContainer, url: AbsoluteUrl }, req?: AuthentifiedReq) {
  assertString(container)
  assertString(url)
  if (federatedMode && req && container === 'entities') {
    return proxyRequestToConvertAndCleanupEntityImageUrl(req, url)
  }
  const originalUrl = url
  if (dataseedEnabled && container === 'entities') {
    const res = await cleanupImageUrl(url)
    url = res.url
  }
  if (!isUrl(url) || (await isPrivateUrl(url))) {
    throw newError('invalid image url', 400, { url, originalUrl })
  }
  const data = await convertImageUrl({ container, url })
  // Returns { hash: undefined } to avoid "Property 'hash' does not exist on type '{}'.ts(2339)"
  if (bannedHashes.has(data.hash)) return { hash: undefined }
  log({ originalUrl, cleanedUrl: url, ...data }, 'convert url')
  return data
}

const bannedHashes = new Set([
  // BNF placeholder
  '34ae223423391eeb6bcd31bf177e77c13aa013a4',
])

async function proxyRequestToConvertAndCleanupEntityImageUrl (req: AuthentifiedReq, url: AbsoluteUrl) {
  return signedFederatedRequest(req, 'post', '/api/images', {
    action: 'convert-url',
    container: 'entities',
    url,
  }) as Promise<Partial<ImportedImage>>
}
