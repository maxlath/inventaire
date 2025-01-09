import { debounce } from 'lodash-es'
import { getShelfById } from '#controllers/shelves/lib/shelves'
import { getUserById } from '#controllers/user/lib/user'
import { radio } from '#lib/radio'
import { assert_ } from '#lib/utils/assert_types'
import { LogError } from '#lib/utils/logs'
import config from '#server/config'
import type { CreateActivity, ShelfActorName } from '#types/activity'
import type { ShelfId } from '#types/shelf'
import type { User, UserId, Username } from '#types/user'
import { getActivitiesByActorName, createActivity } from './activities.js'
import { deliverEntityActivitiesFromPatch } from './entity_patch_activities.js'
import formatShelfItemsActivities from './format_shelf_items_activities.js'
import formatUserItemsActivities from './format_user_items_activities.js'
import { postActivityToActorFollowersInboxes } from './post_activity.js'

const { activitiesDebounceTime } = config.activitypub
assert_.number(activitiesDebounceTime)
const debouncedActivities = {}

export function initRadioHooks () {
  radio.on('user:inventory:update', userId => {
    if (!debouncedActivities[userId]) {
      debouncedActivities[userId] = debounce(createDebouncedActivity({ userId }), activitiesDebounceTime)
    }
    return debouncedActivities[userId]()
  })
  radio.on('shelves:update', shelvesIds => {
    return Promise.all(shelvesIds.map(debounceActivities))
  })
  radio.on('patch:created', deliverEntityActivitiesFromPatch)
}

interface createActivityParams {
  userId?: UserId
  shelfId?: ShelfId
}

const createDebouncedActivity = ({ userId, shelfId }: createActivityParams) => async () => {
  _createDebouncedActivity({ userId, shelfId })
  .catch(LogError('createDebouncedActivity error'))
}

async function _createDebouncedActivity ({ userId, shelfId }: createActivityParams) {
  let name, user, poolActivities
  if (userId) {
    delete debouncedActivities[userId]
    user = await getUserById(userId) as User
    if (!user.fediversable) return
    ;({ poolActivities } = user)
    name = user.stableUsername as Username
  } else if (shelfId) {
    delete debouncedActivities[shelfId]
    // TODO: if this throws an error because the shelf was deleted
    // create a type=Delete activity instead, to notify the followers
    const shelf = await getShelfById(shelfId)
    if (!shelf.visibility.includes('public')) return
    const owner = await getUserById(shelf.owner)
    if (!owner.fediversable) return
    ;({ poolActivities } = owner)
    // todo: use group slugify to create shelf name
    // shelf = await getShelfById(shelfId)
    name = `shelf-${shelfId}` as ShelfActorName
  }
  const [ lastActivity ] = await getActivitiesByActorName({ name, limit: 1 })
  const since = lastActivity?.updated || 0

  const activityDoc = await createActivity({
    type: 'Create',
    actor: { name },
    object: { items: { since, until: Date.now() } },
  })
  let createActivities: CreateActivity[]
  if (userId) {
    createActivities = await formatUserItemsActivities([ activityDoc ], user)
  } else if (shelfId) {
    createActivities = await formatShelfItemsActivities([ activityDoc ], shelfId, name, poolActivities)
  }
  const activity: CreateActivity = createActivities[0]
  if (!activity) return

  return postActivityToActorFollowersInboxes({ activity, actorName: name })
}

async function debounceActivities (shelfId) {
  if (!debouncedActivities[shelfId]) {
    debouncedActivities[shelfId] = debounce(createDebouncedActivity({ shelfId }), activitiesDebounceTime)
  }
  return debouncedActivities[shelfId]()
}
