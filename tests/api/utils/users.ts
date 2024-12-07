import { getUserAnonymizableId } from '#controllers/user/lib/anonymizable_user'
import type { UserWithCookie } from '#fixtures/users'
import type { ContextualizedError } from '#lib/error/format_error'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { assertObject, assertString } from '#lib/utils/assert_types'
import { federatedMode } from '#server/config'
import { customAuthReq } from '#tests/api/utils/request'
import type { RelativeUrl } from '#types/common'
import type { User } from '#types/user'
import { getUser } from './utils.js'

export async function getUsersNearPosition (position, user) {
  user = user || (await getUser())
  const bbox = getBboxFromPosition(position)
  const url = `/api/users?action=search-by-position&bbox=${JSON.stringify(bbox)}` as RelativeUrl
  const { users } = await customAuthReq(user, 'get', url)
  return users
}

export async function updateUser ({ user, attribute, value }: { user: UserWithCookie, attribute: string, value }) {
  user = await (user || getUser())
  assertObject(user)
  assertString(attribute)
  return customAuthReq(user, 'put', '/api/user', { attribute, value })
}

export const deleteUser = user => customAuthReq(user, 'delete', '/api/user')

const getBboxFromPosition = ([ lat, lng ]) => {
  return [ lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1 ]
}

export function catchSpamRejection (err: ContextualizedError) {
  if (err.statusCode !== 403) throw err
}

export async function getTestUserAcct (user: User) {
  if (federatedMode) {
    const anonymizableUserId = await getUserAnonymizableId(user)
    return getLocalUserAcct(anonymizableUserId)
  } else {
    return getLocalUserAcct(user._id)
  }
}
