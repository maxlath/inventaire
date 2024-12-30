import { uniq } from 'lodash-es'
import { getUsersAuthorizedDataByIds } from '#controllers/user/lib/user'
import { newError } from '#lib/error/error'
import type { Item } from '#types/item'
import type { UserId } from '#types/user'

export default async function (items: Item[], reqUserId: UserId) {
  if (!(items && items.length > 0)) throw newError('no item found', 404)
  const usersIds = getItemsOwners(items)
  const users = await getUsersAuthorizedDataByIds(usersIds, { reqUserId })
  return { items, users }
}

function getItemsOwners (items: Item[]) {
  const users = items.map(item => item.owner)
  return uniq(users) as UserId[]
}
