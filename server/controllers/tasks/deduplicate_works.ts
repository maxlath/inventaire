import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import deduplicateWork from './lib/deduplicate_works.js'

const sanitization = {
  uri: {},
  isbn: {},
}

async function controller ({ uri, isbn, reqUserAcct }: SanitizedParameters) {
  const tasks = await deduplicateWork(uri, isbn, reqUserAcct)
  return {
    tasks: (tasks || []).flat(),
  }
}

export default { sanitization, controller }
