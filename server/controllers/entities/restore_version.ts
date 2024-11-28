import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import { restoreVersion } from './lib/restore_version.js'

const sanitization = {
  patch: {},
}

async function controller ({ patchId, reqUserAcct }: SanitizedParameters) {
  await restoreVersion(patchId, reqUserAcct)
  return { ok: true }
}

export default { sanitization, controller }
