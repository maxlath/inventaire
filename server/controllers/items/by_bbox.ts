import { groupBy, isNumber } from 'lodash-es'
import { filterMaximumItemsPerOwner } from '#controllers/items/lib/filter_maximum_items_per_owner'
import { getAuthorizedItemsByUsers } from '#controllers/items/lib/get_authorized_items'
import { removeUnauthorizedShelves } from '#controllers/items/lib/queries_commons'
import { addItemsSnapshots } from '#controllers/items/lib/snapshot/snapshot'
import { getUsersAuthorizedData, getUsersByBbox } from '#controllers/user/lib/user'
import { reqHasAdminAccess } from '#lib/user_access_levels'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { SerializedItem } from '#types/item'
import type { Req } from '#types/server'

const sanitization = {
  bbox: {},
  limit: {
    default: 15,
  },
  lang: {
    default: 'en',
  },
}

async function controller (params: SanitizedParameters, req: Req) {
  const { bbox, limit, lang, reqUserId } = params
  const reqUserHasAdminAccess = reqHasAdminAccess(req)
  const usersPromise = getUsersByBbox(bbox)
  const filteredUsers = await getUsersAuthorizedData(usersPromise, { reqUserId, reqUserHasAdminAccess })
  // No need to fetch items for all the users found: assuming users will on average have more than 2 public books
  const sampleLength = Math.ceil(limit / 2)
  const usersSample = filteredUsers.sort(byLastPublicItemAddition).slice(0, sampleLength)
  const usersByIds = groupBy(usersSample, '_id')
  const usersIds = Object.keys(usersByIds)
  const authorizedItems = await getAuthorizedItemsByUsers(usersIds, params.reqUserId)

  const filteredItems = filterMaximumItemsPerOwner(authorizedItems, lang, limit)

  const serializedItems: SerializedItem[] = await addItemsSnapshots(filteredItems)
  await removeUnauthorizedShelves(serializedItems, reqUserId)
  return { items: serializedItems, users: usersSample }
}

type FormattedUser = Awaited<ReturnType<typeof getUsersAuthorizedData>>[number]
function byLastPublicItemAddition (a: FormattedUser, b: FormattedUser) {
  return getLastPublicItemAddition(b) - getLastPublicItemAddition(a)
}

function getLastPublicItemAddition (user: FormattedUser) {
  if ('snapshot' in user && 'public' in user.snapshot && isNumber(user.snapshot.public['items:last-add'])) {
    return user.snapshot.public['items:last-add']
  } else {
    return 0
  }
}

export default { sanitization, controller }
