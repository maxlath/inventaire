import { map, uniq } from 'lodash-es'
import { addSnapshotToItem } from '#controllers/items/lib/snapshot/snapshot'
import { getShelvesByIds } from '#controllers/shelves/lib/shelves'
import { setItemsBusyFlag } from '#controllers/transactions/lib/transactions'
import { getUsersAuthorizedDataByIds } from '#controllers/user/lib/user'
import { paginate, type PageParams } from '#lib/pagination'
import { filterVisibleDocs } from '#lib/visibility/filter_visible_docs'
import type { Item } from '#types/item'

async function addUsersData (page, reqParams) {
  const { reqUserId, includeUsers } = reqParams
  if (includeUsers === false) return page

  const { items } = page
  if (items.length === 0) {
    page.users = []
    return page
  }

  const ownersIds = uniq(map(items, 'owner'))

  const users = await getUsersAuthorizedDataByIds(ownersIds, { reqUserId })
  page.users = users
  return page
}

export function addItemsSnapshots (items) {
  return Promise.all(items.map(addSnapshotToItem))
}

export async function addAssociatedData (page, reqParams) {
  await Promise.all([
    addItemsSnapshots(page.items),
    addUsersData(page, reqParams),
    setItemsBusyFlag(page.items),
    removeUnauthorizedShelves(page.items, reqParams.reqUserId),
  ])
  return page
}

async function removeUnauthorizedShelves (items, reqUserId) {
  const shelvesIds = uniq(map(items, 'shelves').flat())
  const shelves = await getShelvesByIds(shelvesIds)
  const authorizedShelves = await filterVisibleDocs(shelves, reqUserId)
  const authorizedShelvesIds = new Set(map(authorizedShelves, '_id'))
  for (const item of items) {
    item.shelves = item.shelves.filter(shelfdId => authorizedShelvesIds.has(shelfdId))
  }
}

export function paginateItems (items: Item[], params: PageParams) {
  const { page, total, offset, context } = paginate<Item>(items, params)
  return { items: page, total, offset, context }
}
