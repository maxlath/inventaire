import { keyBy } from 'lodash-es'
import { anonymizeUser, getUsersByAnonymizedIds } from '#controllers/user/lib/anonymizable_user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'

const sanitization = {
  ids: {},
}

async function controller ({ ids }: SanitizedParameters) {
  const users = await getUsersByAnonymizedIds(ids)
  const anonymizedUsers = users.map(anonymizeUser)
  return { users: keyBy(anonymizedUsers, '_id') }
}

export default { sanitization, controller }
