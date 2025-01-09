import { compact, flatten } from 'lodash-es'
import { getPublicItemsByShelfAndDate } from '#controllers/items/lib/items'
import type { CreateActivity } from '#types/activity'
import type { RelativeUrl, AbsoluteUrl } from '#types/common'
import { buildItemsCreateActivities, buildPooledCreateActivities, findFullRangeFromActivities } from './format_items_activities.js'
import { makeUrl } from './helpers.js'

export default async function (activitiesDocs, shelfId, name, poolActivities) {
  if (activitiesDocs.length === 0) return
  const actor: AbsoluteUrl = makeUrl({ params: { action: 'actor', name } })
  const parentLink: RelativeUrl = `/shelves/${shelfId}`
  const { since, until } = findFullRangeFromActivities(activitiesDocs)
  const allActivitiesItems = await getPublicItemsByShelfAndDate({
    shelf: shelfId,
    since,
    until,
  })

  let formattedActivities: CreateActivity[] = []

  if (poolActivities) {
    formattedActivities = await Promise.all(activitiesDocs.map(buildPooledCreateActivities({ allActivitiesItems, name, actor, parentLink })))
  } else {
    formattedActivities = flatten(await Promise.all(activitiesDocs.map(buildItemsCreateActivities({ allActivitiesItems, name, actor, parentLink }))
    ))
  }
  return compact(formattedActivities)
}
