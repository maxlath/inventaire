import { difference, map, union } from 'lodash-es'
import { addItemsSnapshots } from '#controllers/items/lib/snapshot/snapshot'
import { dbFactory } from '#db/couchdb/base'
import { newError } from '#lib/error/error'
import { emit } from '#lib/radio'
import { assertNumber, assertArray, assertString } from '#lib/utils/assert_types'
import { deepCompact, forceArray } from '#lib/utils/base'
import { changeItemDocOwner, createItemDoc, updateItemDoc } from '#models/item'
import type { Item } from '#types/item'
import { filterPrivateAttributes } from './filter_private_attributes.js'
import { addSnapshotToItem } from './snapshot/snapshot.js'
import { validateItemsAsync } from './validate_item_async.js'

const db = await dbFactory('items')

export const getItemById = db.get<Item>
export const getItemsByIds = db.byIds<Item>
export const getItemsByOwner = ownerId => db.getDocsByViewKeys<Item>('byOwner', [ ownerId ])
export const getItemsByOwners = ownersIds => db.getDocsByViewKeys<Item>('byOwner', ownersIds)
export const getItemsByEntity = entityUri => db.getDocsByViewKeys<Item>('byEntity', [ entityUri ])
export const getItemsByEntities = entitiesUris => db.getDocsByViewKeys<Item>('byEntity', entitiesUris)

export function getItemsByOwnerAndEntities (ownerId, entitiesUris) {
  const keys = entitiesUris.map(uri => [ ownerId, uri ])
  return db.getDocsByViewKeys<Item>('byOwnerAndEntity', keys)
}

export const getItemsByPreviousEntity = entityUri => db.getDocsByViewKey<Item>('byPreviousEntity', entityUri)

export function getPublicItemsByOwnerAndDate ({ ownerId, since, until }) {
  assertString(ownerId)
  assertNumber(since)
  assertNumber(until)
  return db.getDocsByViewQuery<Item>('publicByOwnerAndDate', {
    include_docs: true,
    startkey: [ ownerId, until ],
    endkey: [ ownerId, since ],
    descending: true,
  })
}

export function getPublicItemsByShelfAndDate ({ shelf, since, until }) {
  assertString(shelf)
  assertNumber(since)
  assertNumber(until)
  return db.getDocsByViewQuery<Item>('publicByShelfAndDate', {
    include_docs: true,
    startkey: [ shelf, until ],
    endkey: [ shelf, since ],
    descending: true,
  })
}

export function getPublicItemsByDate (limit = 15, offset = 0, assertImage = false, reqUserId) {
  return db.getDocsByViewQuery<Item>('publicByDate', {
    limit,
    skip: offset,
    descending: true,
    include_docs: true,
  })
  .then(filterWithImage(assertImage))
  .then(formatItems(reqUserId))
}

export async function createItems (userId, items) {
  assertArray(items)
  items = items.map(item => createItemDoc(userId, item))
  await validateItemsAsync(items)
  const res = await db.bulk(items)
  const itemsIds = map(res, 'id')
  const shelvesIds = deepCompact(map(items, 'shelves'))
  const [ { docs } ] = await Promise.all([
    db.fetch<Item>(itemsIds),
    emit('user:inventory:update', userId),
    emit('shelves:update', shelvesIds),
  ])
  return docs
}

export async function updateItems (userId, itemUpdateData) {
  await validateItemsAsync([ itemUpdateData ])
  const currentItem = await db.get<Item>(itemUpdateData._id)
  let updatedItem = updateItemDoc(userId, itemUpdateData, currentItem)
  updatedItem = await db.putAndReturn(updatedItem)
  await emit('user:inventory:update', userId)
  return updatedItem
}

export function changeItemOwner (transacDoc) {
  const { item } = transacDoc
  return db.get<Item>(item)
  .then(changeItemDocOwner.bind(null, transacDoc))
  .then(db.postAndReturn)
}

// Data serializa emails and rss feeds templates
export async function serializeItemData (item) {
  item = await addSnapshotToItem(item)
  const { 'entity:title': title, 'entity:authors': authors, 'entity:image': image } = item.snapshot
  item.title = title
  item.authors = authors
  if (image != null) item.pictures = [ image ]
  return item
}

export async function updateItemsShelves (action, shelvesIds, userId, itemsIds) {
  const items = await getItemsByIds(itemsIds)
  validateOwnership(userId, items)
  const updatedItems = items.map(item => {
    item.shelves = actionFunctions[action](item.shelves, shelvesIds)
    return item
  })
  return db.bulk(updatedItems)
}

export const itemsBulkUpdate = db.bulk
export const itemsBulkDelete = db.bulkDelete

function validateOwnership (userId, items) {
  items = forceArray(items)
  for (const item of items) {
    if (item.owner !== userId) {
      throw newError('wrong owner', 400, { userId, itemId: item._id })
    }
  }
}

const formatItems = reqUserId => async items => {
  items = await addItemsSnapshots(items)
  return items.map(filterPrivateAttributes(reqUserId))
}

const filterWithImage = assertImage => async items => {
  items = await addItemsSnapshots(items)
  if (assertImage) return items.filter(itemWithImage)
  else return items
}

const itemWithImage = item => item.snapshot['entity:image'] != null

const actionFunctions = {
  addShelves: union,
  deleteShelves: difference,
}
