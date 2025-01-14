import type { ParsedForm } from '#controllers/images/lib/parse_form'
import { isNonEmptyPlainObject } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { assertArray, assertObject, assertString } from '#lib/utils/assert_types'
import { objectEntries } from '#lib/utils/base'
import { Log } from '#lib/utils/logs'
import type { FormReq } from '#types/server'
import { containers, uploadContainersNames } from './lib/containers.js'

const sanitization = {
  nonJsonBody: true,
  container: {
    generic: 'allowlist',
    allowlist: uploadContainersNames,
  },
}

async function controller (params, req: FormReq) {
  const { container } = params

  const { putImage } = containers[container]

  if (!req.form) throw newError('missing form data', 400)

  const files = getFilesFromFormData(req.form)

  return Promise.all(files.map(putImage))
  .then(indexUrlById)
  .then(Log('uploaded images'))
}

function getFilesFromFormData (formData: ParsedForm) {
  const { files } = formData

  if (!isNonEmptyPlainObject(files)) {
    throw newError('no file provided', 400, { formData })
  }

  return objectEntries(files).map(([ key, fileArray ]) => {
    assertArray(fileArray)
    const file = fileArray[0]
    assertObject(file)
    // @ts-expect-error
    assertString(file.filepath)
    Object.assign(file, {
      id: key,
      // This somehow does not have any effect: the "path" attribute is undefined when we reach transformAndPutImage
      // @ts-expect-error
      path: file.pathname,
    })
    return file
  })
}

function indexUrlById (collection) {
  const index = {}
  collection.forEach(({ id, url }) => {
    index[id] = url
  })
  return index
}

export default { sanitization, controller }
