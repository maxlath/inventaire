import { getUserByPosition, getUsersAuthorizedData } from '#controllers/user/lib/user'
import { reqHasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { Req } from '#types/server'

const sanitization = {
  bbox: {},
}

async function controller ({ bbox, reqUserId }: SanitizedParameters, req: Req) {
  const reqUserHasAdminAccess = reqHasAdminAccess(req)
  let users = await getUserByPosition(bbox)
  users = await getUsersAuthorizedData(users, { reqUserId, reqUserHasAdminAccess })
  return { users }
}

export default { sanitization, controller }
