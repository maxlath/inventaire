import { keyBy } from 'lodash-es'
import { anonymizeUser, getUsersByAnonymizedIds } from '#controllers/user/lib/anonymizable_user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'

const sanitization = {
  ids: {},
}

// This endpoint is primarily used for sharing user info between instances
// It plays the role of a webfinger with multi-user per request support
async function controller ({ ids }: SanitizedParameters) {
  const users = await getUsersByAnonymizedIds(ids)
  const anonymizedUsers = users.map(user => anonymizeUser(user))
  return { users: keyBy(anonymizedUsers, 'anonymizableId') }
}

export default { sanitization, controller }
