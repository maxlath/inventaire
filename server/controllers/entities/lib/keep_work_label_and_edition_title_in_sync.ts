import { uniq } from 'lodash-es'
import { getEntityById, getWorkEditions } from '#controllers/entities/lib/entities'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { isNonEmptyString } from '#lib/boolean_validations'
import { buildLocalUserAcct } from '#lib/federation/remote_user'
import { warn, info, LogError } from '#lib/utils/logs'
import { getOriginalLang } from '#lib/wikidata/get_original_lang'
import type { InvEntity } from '#types/entity'
import { updateLabel } from './update_label.js'
import type { WikimediaLanguageCode } from 'wikibase-sdk'

const hookUserAcct = buildLocalUserAcct(hardCodedUsers.hook.anonymizableId)

// TODO: also check for edition subtitle

export async function keepWorkLabelAndEditionTitleInSync (edition: InvEntity, oldTitle: string) {
  const workUris = edition.claims['wdt:P629']
  // Ignore composite editions
  if (workUris.length !== 1) return
  const workUri = getFirstClaimValue(edition.claims, 'wdt:P629')
  const editionLang = getOriginalLang(edition.claims)

  if (editionLang == null) {
    warn(edition._id, "couldn't apply hook: edition miss a lang")
    return
  }

  const [ prefix, id ] = workUri.split(':')
  // local work entity all have an 'inv' prefix
  if (prefix !== 'inv') return

  // Check the opinion from other editions of this lang
  return fetchLangConsensusTitle(workUri, editionLang)
  .then(consensusEditionTitle => {
    if (!isNonEmptyString(consensusEditionTitle)) return
    return getEntityById(id)
    .then(updateWorkLabel(editionLang, oldTitle, consensusEditionTitle))
  })
  .catch(LogError('hook update err'))
}

async function fetchLangConsensusTitle (workUri, editionLang) {
  const editions = await getWorkEditions(workUri)

  const titles = editions
    .filter(edition => getOriginalLang(edition.claims) === editionLang)
    .map(edition => getFirstClaimValue(edition.claims, 'wdt:P1476'))

  const differentTitles = uniq(titles)
  if (differentTitles.length === 1) {
    return differentTitles[0]
  } else {
    return null
  }
}

function updateWorkLabel (editionLang: WikimediaLanguageCode, oldTitle: string, consensusEditionTitle: string) {
  return function (workDoc: InvEntity) {
    const currentEditionLangLabel = workDoc.labels[editionLang]
    const workLabelAndEditionTitleSynced = oldTitle === currentEditionLangLabel
    const noWorkLabel = (currentEditionLangLabel == null)
    if (noWorkLabel || workLabelAndEditionTitleSynced) {
      info([ workDoc._id, editionLang, consensusEditionTitle ], 'hook update')
      return updateLabel(editionLang, consensusEditionTitle, hookUserAcct, workDoc)
    }
  }
}
