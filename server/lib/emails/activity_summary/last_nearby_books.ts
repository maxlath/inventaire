import { getAuthorizedItemsByUsers } from '#controllers/items/lib/get_authorized_items'
import { serializeItemData } from '#controllers/items/lib/items'
import { getUsersAuthorizedDataByIds, getUsersNearby } from '#controllers/user/lib/user'
import { shortLang } from '#lib/utils/base'
import type { User } from '#types/user'
import { getLastItems, formatActivitySummaryItemsData, getActivitySummaryItemsViewModels, getHighlightedItems } from './last_books_helpers.js'

const range = 20
const strictRange = true

export async function getLastNearbyPublicBooks (user: User, limitDate: number = 0) {
  const { _id: reqUserId, position, language } = user
  const lang = shortLang(language)

  if (position == null) return formatActivitySummaryItemsData([], 'nearby', lang, 0)

  const usersIds = await getUsersNearby(reqUserId, range, strictRange)
  const [ items, users ] = await Promise.all([
    getAuthorizedItemsByUsers(usersIds, reqUserId),
    getUsersAuthorizedDataByIds(usersIds, { reqUserId }),
  ])

  return formatItems({ items, users, limitDate, position, lang })
}

function formatItems ({ items, users, limitDate, position, lang }) {
  items = items.map(serializeItemData)
  const lastItems = getLastItems(limitDate, items)
  const highlighted = getHighlightedItems(lastItems, 10)
  const activitySummaryItemsViewModels = getActivitySummaryItemsViewModels(highlighted, users, position)
  return formatActivitySummaryItemsData(activitySummaryItemsViewModels, 'nearby', lang, lastItems.length)
}
