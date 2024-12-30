import { getAllGroupMembersIds } from '#controllers/groups/lib/users_lists'
import { getUsersAuthorizedDataByIds } from '#controllers/user/lib/user'
import type { Group } from '#types/group'
import type { UserId } from '#types/user'

export default async function (group: Group, reqUserId: UserId) {
  const usersIds = getAllGroupMembersIds(group)
  const users = await getUsersAuthorizedDataByIds(usersIds, { reqUserId })
  return { group, users }
}
