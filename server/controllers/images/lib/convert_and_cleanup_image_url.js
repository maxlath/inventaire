import CONFIG from 'config'
import _ from '#builders/utils'
import error_ from '#lib/error/error'
import { cleanupImageUrl } from '#data/dataseed/dataseed'
import assert_ from '#lib/utils/assert_types'
import isPrivateUrl from '#lib/network/is_private_url'
import convertImageUrl from './convert_image_url.js'

const { enabled: dataseedEnabled } = CONFIG.dataseed

export default async ({ container, url }) => {
  assert_.string(container)
  assert_.string(url)
  const originalUrl = url
  if (dataseedEnabled && container === 'entities') {
    const res = await cleanupImageUrl(url)
    url = res.url
  }
  if (!_.isUrl(url) || (await isPrivateUrl(url))) {
    throw error_.new('invalid image url', 400, { url, originalUrl })
  }
  const data = await convertImageUrl({ container, url })
  if (bannedHashes.has(data.hash)) return {}
  _.log({ originalUrl, cleanedUrl: url, ...data }, 'convert url')
  return data
}

const bannedHashes = new Set([
  // BNF placeholder
  '34ae223423391eeb6bcd31bf177e77c13aa013a4'
])
