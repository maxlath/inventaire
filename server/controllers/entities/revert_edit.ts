import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import { revertFromPatchId } from './lib/revert_edit.js'

const sanitization = {
  patch: {},
}

async function controller ({ patchId, reqUserAcct }: SanitizedParameters) {
  await revertFromPatchId(patchId, reqUserAcct)
  return { ok: true }
}

export default { sanitization, controller }
