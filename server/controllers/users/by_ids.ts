import type { UserExtraAttribute } from '#controllers/user/lib/authorized_user_data_pickers'
import { getUsersIndexedByIds } from '#controllers/user/lib/user'
import { reqHasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq } from '#types/server'

const sanitization = {
  ids: {},
}

async function controller ({ ids, reqUserId }: SanitizedParameters, req: AuthentifiedReq) {
  let extraAttribute: UserExtraAttribute
  const reqUserHasAdminAccess = reqHasAdminAccess(req)
  if (reqUserHasAdminAccess) extraAttribute = 'reports'
  const users = await getUsersIndexedByIds(ids, { reqUserId, reqUserHasAdminAccess, extraAttribute })
  return { users }
}

export default { sanitization, controller }
