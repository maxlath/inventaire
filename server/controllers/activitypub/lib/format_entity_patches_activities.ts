import { getEntitiesList } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { prefixifyInv } from '#controllers/entities/lib/prefix'
import { i18n } from '#lib/emails/i18n/i18n'
import { getBestLangValue } from '#lib/get_best_lang_value'
import config from '#server/config'
import type { CreateActivity, NoteActivity } from '#types/activity'
import type { Url } from '#types/common'
import { makeUrl, getEntityActorName, getActivityIdFromPatchId, context } from './helpers.js'

const origin = config.getPublicOrigin()

export default rows => {
  rows = rows.filter(hasActivityText)
  return Promise.all(rows.map(formatEntityPatchActivity))
}

const activityText = {
  'wdt:P50': 'author_has_new_work',
  'wdt:P123': 'publisher_has_new_edition',
  'wdt:P195': 'collection_has_new_edition',
  'wdt:P921': 'subject_has_new_work',
}

const hasActivityText = ({ value: property }) => activityText[property] != null

async function formatEntityPatchActivity (row, rowIndex) {
  const { id: patchId, key, value: property } = row
  const [ objectUri, timestamp ] = key
  const subjectUri = prefixifyInv(patchId.split(':')[0])
  const [ subjectEntity, objectEntity ] = await getEntitiesList([ subjectUri, objectUri ])
  const subjectLabel = getLabel(subjectEntity)
  const objectLabel = getLabel(objectEntity)
  const activityId = getActivityIdFromPatchId(patchId, rowIndex)
  const id: Url = `${origin}/api/activitypub?action=activity&id=${activityId}`
  const name = getEntityActorName(objectUri)
  const actor: Url = makeUrl({ params: { action: 'actor', name } })
  const subjectUrl = `${origin}/entity/${subjectUri}`
  const objectUrl = `${origin}/entity/${objectUri}`

  const object: NoteActivity = {
    id,
    type: 'Note',
    content: `<p>${i18n('en', activityText[property], { subjectLabel, subjectUrl, objectLabel, objectUrl })}</p>`,
    published: new Date(timestamp).toISOString(),
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

function getLabel (entity) {
  const label = getBestLangValue('en', entity.originalLang, entity.labels).value
  if (label) return label
  else return getFirstClaimValue(entity.claims, 'wdt:P1476')
}
