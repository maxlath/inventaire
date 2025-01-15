import { map, uniq } from 'lodash-es'
import { getEntitiesByUris } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getAuthorizedItemsByGroup, getAuthorizedItemsByShelves, getAuthorizedItemsByUsers } from '#controllers/items/lib/get_authorized_items'
import { getShelfById } from '#controllers/shelves/lib/shelves'
import { newMissingQueryError } from '#lib/error/pre_filled'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { SerializedEntitiesByUris } from '#types/entity'
import { bundleViewData } from './lib/view/bundle_view_data.js'
import { replaceEditionsByTheirWork } from './lib/view/replace_editions_by_their_work.js'

const sanitization = {
  user: { optional: true },
  group: { optional: true },
  shelf: { optional: true },
  'without-shelf': { optional: true, generic: 'boolean' },
}

async function controller (params: SanitizedParameters) {
  validateUserOrGroup(params)
  const items = await getItems(params)
  const entitiesData = await getItemsEntitiesData(items)
  return bundleViewData(items, entitiesData)
}

function validateUserOrGroup (params) {
  if (!(params.user || params.group || params.shelf)) {
    throw newMissingQueryError('user|group|shelf')
  }
}

async function getItems (params) {
  const { user: userId, group: groupId, shelf: shelfId, reqUserId, 'without-shelf': withoutShelf } = params
  if (userId) {
    return getAuthorizedItemsByUsers([ userId ], reqUserId, { withoutShelf })
  } else if (shelfId) {
    const shelfDoc = await getShelfById(shelfId)
    return getAuthorizedItemsByShelves([ shelfDoc ], reqUserId)
  } else {
    return getAuthorizedItemsByGroup(groupId, reqUserId)
  }
}

async function getItemsEntitiesData (items) {
  const uris = uniq(map(items, 'entity'))
  const { entities } = await getEntitiesByUris({ uris })
  return replaceEditionsByTheirWork(entities as SerializedEntitiesByUris)
}

export default { sanitization, controller }
