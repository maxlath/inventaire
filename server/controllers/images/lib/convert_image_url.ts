import { uniq } from 'lodash-es'
import { dbFactory } from '#db/couchdb/base'
import { isImageHash } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { log } from '#lib/utils/logs'
import type { RelativeUrl } from '#types/common'
import type { ImageHash } from '#types/image'
import importImage from './import_image.js'

const db = await dbFactory('images')

export default ({ url: sourceImageUrl, container }) => importAndAddImage(container, sourceImageUrl)

export interface ImportedImage {
  url: RelativeUrl
  hash: ImageHash
}

async function importAndAddImage (container, sourceImageUrl) {
  const { url } = await importImage(container, sourceImageUrl)
  const hash = url.split('/').at(-1)

  if (!isImageHash(hash)) {
    throw newError('invalid hash', 500, { sourceImageUrl, hash })
  }

  if (container === 'entities') await saveImageSource(sourceImageUrl, hash)

  return { url, hash } as ImportedImage
}

async function saveImageSource (sourceImageUrl, imageHash) {
  await db.update(imageHash, doc => {
    doc.sources = doc.sources || []
    doc.sources.push(sourceImageUrl)
    doc.sources = uniq(doc.sources)
    doc.updated = Date.now()
    return doc
  }, { createIfMissing: true })
  log(sourceImageUrl, `adding source for ${imageHash}`)
}
