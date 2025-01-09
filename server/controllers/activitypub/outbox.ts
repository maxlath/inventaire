import { getActivitiesByActorName, getActivitiesCountByName } from '#controllers/activitypub/lib/activities'
import { getEntityActorName } from '#controllers/activitypub/lib/helpers'
import { getPatchesByClaimValue, getPatchesCountByClaimValue } from '#controllers/entities/lib/patches/patches'
import { isEntityUri, isUsername } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import type { Outbox } from '#types/activity'
import type { AbsoluteUrl } from '#types/common'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { Req, Res } from '#types/server'
import formatEntityPatchesActivities from './lib/format_entity_patches_activities.js'
import formatShelfItemsActivities from './lib/format_shelf_items_activities.js'
import formatUserItemsActivities from './lib/format_user_items_activities.js'
import { makeUrl, getEntityUriFromActorName, context, setActivityPubContentType } from './lib/helpers.js'
import { validateUser, validateShelf, validateEntity } from './lib/validations.js'

const sanitization = {
  name: {},
  offset: {
    optional: true,
    default: null,
  },
  limit: {
    optional: true,
    default: 10,
  },
}

async function controller (params: SanitizedParameters, req: Req, res: Res) {
  const { name, offset, limit } = params
  setActivityPubContentType(res)
  if (isEntityUri(getEntityUriFromActorName(name))) {
    return getEntityActivities({ name, offset, limit })
  } else if (name.startsWith('shelf-')) {
    return getShelfActivities({ name, offset, limit })
  } else if (isUsername(name)) {
    return getUserActivities({ name, offset, limit })
  } else {
    throw newError('invalid name', 400, { name })
  }
}

async function getShelfActivities ({ name, offset, limit }) {
  const { shelf, owner } = await validateShelf(name)
  const fullOutboxUrl = makeUrl({ params: { action: 'outbox', name } })
  const baseOutbox = getBaseOutbox(fullOutboxUrl)
  if (offset == null) {
    baseOutbox.totalItems = await getActivitiesCountByName(name)
    return baseOutbox
  } else {
    return buildPaginatedShelfOutbox(shelf, name, offset, limit, baseOutbox, owner.poolActivities)
  }
}

async function getEntityActivities ({ name, offset, limit }) {
  const { entity } = await validateEntity(name)
  const actorName = getEntityActorName(entity.uri)
  const fullOutboxUrl = makeUrl({ params: { action: 'outbox', name: actorName } })
  const baseOutbox: Outbox = {
    '@context': context,
    id: fullOutboxUrl,
    type: 'OrderedCollection',
    first: `${fullOutboxUrl}&offset=0`,
    next: `${fullOutboxUrl}&offset=0`,
  }
  if (offset == null) {
    baseOutbox.totalItems = await getPatchesCountByClaimValue(entity.uri)
    return baseOutbox
  } else {
    return buildPaginatedEntityOutbox(entity, offset, limit, baseOutbox)
  }
}

function getBaseOutbox (url: AbsoluteUrl) {
  const outbox: Outbox = {
    '@context': context,
    id: url,
    type: 'OrderedCollection',
    first: `${url}&offset=0`,
    next: `${url}&offset=0`,
  }
  return outbox
}

async function getUserActivities ({ name, offset, limit }) {
  const { user } = await validateUser(name)
  const fullOutboxUrl = makeUrl({ params: { action: 'outbox', name: user.stableUsername } })
  const baseOutbox: Outbox = {
    '@context': context,
    id: fullOutboxUrl,
    type: 'OrderedCollection',
    first: `${fullOutboxUrl}&offset=0`,
    next: `${fullOutboxUrl}&offset=0`,
  }
  if (offset == null) {
    // Mimick Mastodon, which only indicates the totalItems count when fetching
    // type=OrderedCollection page
    // TODO: remove empty activities from count? as it's otherwise surprising
    // to find 0 activities, when the OrderedCollection says there are activities
    baseOutbox.totalItems = await getActivitiesCountByName(user.stableUsername)
    return baseOutbox
  } else {
    return buildPaginatedUserOutbox(user, offset, limit, baseOutbox)
  }
}

export default { sanitization, controller }

async function buildPaginatedUserOutbox (user, offset, limit, outbox) {
  const { id: fullOutboxUrl } = outbox
  outbox.type = 'OrderedCollectionPage'
  outbox.partOf = fullOutboxUrl
  outbox.next = `${fullOutboxUrl}&offset=${offset + limit}`
  const { stableUsername } = user
  const activitiesDocs = await getActivitiesByActorName({ name: stableUsername, offset, limit })
  outbox.orderedItems = await formatUserItemsActivities(activitiesDocs, user)
  return outbox
}

async function buildPaginatedShelfOutbox (shelf, name, offset, limit, outbox, poolActivities) {
  const { id: fullOutboxUrl } = outbox
  outbox.type = 'OrderedCollectionPage'
  outbox.partOf = fullOutboxUrl
  outbox.next = `${fullOutboxUrl}&offset=${offset + limit}`
  const activitiesDocs = await getActivitiesByActorName({ name, offset, limit })
  outbox.orderedItems = await formatShelfItemsActivities(activitiesDocs, shelf._id, name, poolActivities)
  return outbox
}

async function buildPaginatedEntityOutbox (entity, offset, limit, outbox) {
  const { id: fullOutboxUrl } = outbox
  outbox.type = 'OrderedCollectionPage'
  outbox.partOf = fullOutboxUrl
  outbox.next = `${fullOutboxUrl}&offset=${offset + limit}`
  const { uri } = entity
  const rows = await getPatchesByClaimValue(uri, offset, limit)
  outbox.orderedItems = await formatEntityPatchesActivities(rows)
  return outbox
}
