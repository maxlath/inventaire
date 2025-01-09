import { getActivityById } from '#controllers/activitypub/lib/activities'
import { buildNoteActivity, buildCreateActivity } from '#controllers/activitypub/lib/format_items_activities'
import { makeUrl } from '#controllers/activitypub/lib/helpers'
import { getPatchById } from '#controllers/entities/lib/patches/patches'
import { addSnapshotToItem } from '#controllers/items/lib/snapshot/snapshot'
import { isCouchUuid } from '#lib/boolean_validations'
import { newError, notFoundError } from '#lib/error/error'
import type { RelativeUrl } from '#types/common'
import type { CouchUuid } from '#types/couchdb'
import type { SerializedItem, Item } from '#types/item'
import type { PatchId } from '#types/patch'
import type { Req, Res } from '#types/server'
import type { User } from '#types/user'
import { getActivitiesFromPatch } from './lib/entity_patch_activities.js'
import formatShelfItemsActivities from './lib/format_shelf_items_activities.js'
import formatUserItemsActivities from './lib/format_user_items_activities.js'
import { isEntityActivityId, setActivityPubContentType } from './lib/helpers.js'
import { validateShelf, validateUser, validateItem } from './lib/validations.js'

interface ActivityArgs {
  id: string
}

const sanitization = {
  id: {
    // override couchUuid validation
    generic: 'string',
  },
}

async function controller ({ id }: ActivityArgs, req: Req, res: Res) {
  setActivityPubContentType(res)
  if (isEntityActivityId(id)) {
    return getEntityActivity(id)
  } else if (id.startsWith('item-')) {
    return getItemActivity(id)
  } else {
    return getActivity(id)
  }
}

async function getEntityActivity (id) {
  let [ , entityId, versionNumber, activityNumber ] = id.split('-')
  const patchId: PatchId = `${entityId}:${versionNumber}`
  const patch = await getPatchById(patchId)
  const activities = await getActivitiesFromPatch(patch)
  activityNumber = parseInt(activityNumber)
  const activity = activities[activityNumber]
  if (!activity) throw notFoundError({ id })
  return activity
}

async function getActivity (id: CouchUuid) {
  if (!isCouchUuid(id)) throw newError('invalid activity id', 400, { id })
  const activityDoc = await getActivityById(id)
  const { name } = activityDoc.actor
  if (name.startsWith('shelf-')) {
    return getShelfActivity(activityDoc, name)
  } else {
    return getUserActivity(activityDoc, name)
  }
}

async function getUserActivity (activityDoc, name) {
  const { user } = await validateUser(name)
  const [ activity ] = await formatUserItemsActivities([ activityDoc ], user)
  return activity
}

async function getItemActivity (id) {
  const itemId = id.split('-')[1]
  if (!isCouchUuid(itemId)) throw newError('invalid item id', 400, { itemId })
  const { item: rawItem, owner }: { item: Item, owner: User } = await validateItem(itemId)
  const item: SerializedItem = await addSnapshotToItem(rawItem)
  const name = item.snapshot['entity:title']
  const parentLink: RelativeUrl = `/users/${owner._id}`
  const { language } = owner
  const actorUrl = makeUrl({ params: { action: 'activity', name, offset: 0 } })

  const noteActivity = buildNoteActivity(item, name, language, parentLink, item.created)
  return buildCreateActivity(noteActivity, actorUrl)
}

async function getShelfActivity (activityDoc, name) {
  const { shelf, owner } = await validateShelf(name)
  const [ activity ] = await formatShelfItemsActivities([ activityDoc ], shelf._id, name, owner.poolActivities)
  return activity
}

export default {
  sanitization,
  controller,
}
