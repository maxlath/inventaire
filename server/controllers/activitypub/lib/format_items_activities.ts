import { compact, map, max, min } from 'lodash-es'
import { context } from '#controllers/activitypub/lib/helpers'
import { addSnapshotToItem } from '#controllers/items/lib/snapshot/snapshot'
import { i18n } from '#lib/emails/i18n/i18n'
import config from '#server/config'
import type { ActivityDoc, ItemNote, NoteActivity, CreateActivity, Attachment } from '#types/activity'
import type { Url, AbsoluteUrl, RelativeUrl } from '#types/common'

const origin = config.getPublicOrigin()
const maxLinksToDisplay = 3

export function buildPooledCreateActivities ({ allActivitiesItems, lang = 'en', name, actor, parentLink }: ItemNote) {
  return async function (activityDoc: ActivityDoc) {
    const { since, until } = activityDoc.object.items
    // todo: pre-sorting the items per range
    const publicRangeItems = allActivitiesItems.filter(itemsWithinActivityRange(since, until))

    if (publicRangeItems.length === 0) return

    const firstItems = publicRangeItems.slice(0, 3)
    await Promise.all(firstItems.map(addSnapshotToItem))
    const links = firstItems.map(buildLinkContentFromItem)
    // itemsLength as in OrderedItems (not user's item)
    const itemsLength = publicRangeItems.length

    const id: Url = `${origin}/api/activitypub?action=activity&id=${activityDoc._id}`

    const object: NoteActivity = {
      id,
      type: 'Note',
      content: buildContent({ links, name, lang, itemsLength, parentLink }),
      published: new Date(until).toISOString(),
      attachment: compact(firstItems.map(buildAttachment)),
    }
    const createdActivity: CreateActivity = {
      id: `${id}#create`,
      '@context': context,
      type: 'Create',
      object,
      actor,
      to: [ 'Public' ],
    }
    return createdActivity
  }
}

export function buildItemsCreateActivities ({ allActivitiesItems, lang = 'en', name, actor, parentLink }: ItemNote) {
  return async function (activityDoc: ActivityDoc) {
    const { since, until } = activityDoc.object.items
    // todo: pre-sorting the items per range
    const publicRangeItems = allActivitiesItems.filter(itemsWithinActivityRange(since, until))
    await Promise.all(publicRangeItems.map(addSnapshotToItem))

    const noteActivities: NoteActivity[] = publicRangeItems.map(item => buildNoteActivity(item, name, lang, parentLink, until))

    const createdActivities: CreateActivity[] = noteActivities.map(noteActivity => buildCreateActivity(noteActivity, actor))
    return createdActivities
  }
}

export function buildCreateActivity (noteActivity: NoteActivity, actor) {
  const createdActivity: CreateActivity = {
    id: `${noteActivity.id}#create`,
    '@context': context,
    type: 'Create',
    object: noteActivity,
    actor,
    to: [ 'Public' ],
  }
  return createdActivity
}

export function buildNoteActivity (item, name, lang, parentLink, publishedDate) {
  const link = buildLinkContentFromItem(item)
  const id: Url = `${origin}/api/activitypub?action=activity&id=item-${item._id}`

  const noteActivity: NoteActivity = {
    id,
    type: 'Note',
    content: buildContent({ links: [ link ], name, lang, itemsLength: 1, parentLink }),
    published: new Date(publishedDate).toISOString(),
    attachment: [ buildAttachment(item) ],
  }
  return noteActivity
}

export function findFullRangeFromActivities (activitiesDocs) {
  return {
    since: min(map(activitiesDocs, 'object.items.since')),
    until: max(map(activitiesDocs, 'object.items.until')),
  }
}

const itemsWithinActivityRange = (since, until) => item => item.created > since && item.created < until

interface LinkContent {
  text: string
  url: AbsoluteUrl
  details: null
}
function buildLinkContentFromItem (item) {
  const content: LinkContent = {
    text: item.snapshot['entity:title'],
    url: `${origin}/items/${item._id}`,
    details: null,
  }
  const { details } = item
  if (details) content.details = details
  return content
}

interface BuildContentOptions {
  links: LinkContent[]
  name: string
  // Using User.language type
  lang: string
  itemsLength: number
  parentLink: RelativeUrl
}

function buildContent ({ links, name, lang = 'en', itemsLength, parentLink }: BuildContentOptions) {
  let html = `<p>${i18n(lang, 'create_items_activity', { name })} `
  const htmlLinks = links.map(link => {
    return `<a href="${link.url}" rel="nofollow noopener noreferrer" target="_blank">${link.text}</a>`
  })
  html += htmlLinks.join(', ')
  if (itemsLength > maxLinksToDisplay) {
    const url = `${origin}${parentLink}`
    const moreLink = i18n(lang, 'and_x_more_books_to_inventory', { itemsLength: itemsLength - maxLinksToDisplay, link: url })
    html += moreLink
  }
  if (links.length === 1) {
    const firstLinkDetails = links[0].details
    if (firstLinkDetails) html += `\n${firstLinkDetails}`
  }
  html += '</p>'
  return html
}

function buildAttachment (item) {
  const imageUrl = item.snapshot['entity:image']
  if (!imageUrl) return
  const attachment: Attachment = {
    type: 'Image',
    mediaType: 'image/jpeg',
    url: `${origin}${imageUrl}`,
  }
  return attachment
}
