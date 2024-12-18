import { keyBy, omit } from 'lodash-es'
import { getUsersByAccts, type LocalUserWithAcct, type RemoteUserWithAcct } from '#lib/federation/remote_user'
import { hasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq } from '#types/server'

const sanitization = {
  accts: {},
}

// This endpoint is primarily used for server local and remote users info in the client via a unified endpoint
async function controller ({ accts }: SanitizedParameters, req: AuthentifiedReq) {
  const reqUserHasAdminAccess = hasAdminAccess(req.user)
  const users = await getUsersByAccts(accts, { reqUserHasAdminAccess })
  return { users: keyBy(users.map(format), 'acct') }
}

function format (user: LocalUserWithAcct | RemoteUserWithAcct) {
  return omit(user, 'anonymizableId')
}

export default { sanitization, controller }

export type GetUsersByAcctsResponse = Awaited<ReturnType<typeof controller>>
