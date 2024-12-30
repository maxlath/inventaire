import { getUsersAuthorizedDataByIds, getUsersNearby } from '#controllers/user/lib/user'
import { reqHasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { Req } from '#types/server'

const sanitization = {
  range: {},
}

async function controller ({ reqUserId, range }: SanitizedParameters, req: Req) {
  const usersIds = await getUsersNearby(reqUserId, range)
  const reqUserHasAdminAccess = reqHasAdminAccess(req)
  const users = await getUsersAuthorizedDataByIds(usersIds, { reqUserId, reqUserHasAdminAccess })
  return { users }
}

export default { sanitization, controller }
