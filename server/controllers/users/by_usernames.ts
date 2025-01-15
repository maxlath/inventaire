import { getUsersIndexByUsernames } from '#controllers/user/lib/user'
import { reqHasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { Req } from '#types/server'

const sanitization = {
  usernames: {},
}

async function controller ({ usernames, reqUserId }: SanitizedParameters, req: Req) {
  const reqUserHasAdminAccess = reqHasAdminAccess(req)
  const users = await getUsersIndexByUsernames(usernames, reqUserId, reqUserHasAdminAccess)
  return { users }
}

export default { sanitization, controller }
