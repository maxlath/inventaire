import { getReverseClaims } from '#controllers/entities/lib/reverse_claims'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'

const sanitization = {
  property: {},
  value: { type: 'string' },
  refresh: {
    optional: true,
  },
  sort: {
    generic: 'boolean',
    default: false,
  },
}

async function controller (params: SanitizedParameters) {
  const { property, value, refresh, sort } = params
  const uris = await getReverseClaims({
    property,
    value: value as string,
    refresh,
    sort,
  })
  return { uris }
}

export type GetReverseClaimsResponse = Awaited<ReturnType<typeof controller>>

export default { sanitization, controller }
