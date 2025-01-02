import { uniq } from 'lodash-es'
import { getEntityById } from '#controllers/entities/lib/entities'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { getInvEntityType } from '#controllers/entities/lib/get_entity_type'
import { getPublicationYear } from '#controllers/entities/lib/get_publisher_publications'
import { expandInvClaims, getClaimValue, getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { resolveExternalIds } from '#controllers/entities/lib/resolver/resolve_external_ids'
import { omitLocalClaims } from '#controllers/entities/lib/update_wd_claim'
import { getWikidataOAuthCredentials } from '#controllers/entities/lib/wikidata_oauth'
import { temporarilyOverrideWdIdAndIsbnCache } from '#data/wikidata/get_wd_entities_by_isbns'
import { isNonEmptyArray } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { getUserAcct, type MinimalRemoteUser } from '#lib/federation/remote_user'
import { normalizeIsbn } from '#lib/isbn/isbn'
import { logError } from '#lib/utils/logs'
import wdEdit from '#lib/wikidata/edit'
import { getLanguageEnglishLabel, getOriginalLang } from '#lib/wikidata/get_original_lang'
import type { Descriptions, EntityValue, ExpandedClaims, InvEntityUri, WdEntityUri } from '#types/entity'
import type { User } from '#types/user'
import { createWdEntity } from './create_wd_entity.js'
import mergeEntities from './merge_entities.js'
import { unprefixify } from './prefix.js'
import { cacheEntityRelations } from './temporarily_cache_relations.js'

export async function moveInvEntityToWikidata (user: User | MinimalRemoteUser, invEntityUri: InvEntityUri) {
  const userAcct = getUserAcct(user)

  const entityId = unprefixify(invEntityUri)

  const entity = await getEntityById(entityId).catch(rewrite404(invEntityUri))

  if ('redirection' in entity) {
    throw newError('A redirection can not be moved to Wikidata', 400, { invEntityUri, entity })
  }
  if (entity.type === 'removed:placeholder') {
    throw newError('A removed placeholder can not be moved to Wikidata', 400, { invEntityUri, entity })
  }

  let claims, labels
  if ('labels' in entity) labels = entity.labels
  if ('claims' in entity) claims = expandInvClaims(entity.claims)

  const entityType = getInvEntityType(claims['wdt:P31'])

  // Disabling edition transfer until known issues can be resolved
  // Namely, some transfers were followed by the re-creation of the entity
  // Ideas to fix that:
  // - remove isbn uri canonical status, so that the transfered inv entity redirects to the wd entity
  // - remove autocreate=true from entities requests by the editor
  if (entityType === 'edition') {
    throw newError('Can not move an edition to Wikidata', 400, { entity })
  }

  const conflictingWdEntities = await resolveExternalIds(claims, {
    resolveOnWikidata: true,
    resolveLocally: false,
    refresh: true,
  })
  if (conflictingWdEntities?.length > 0) {
    throw newError('Can not move to Wikidata: some Wikidata entities share the same identifiers', 400, { conflicts: conflictingWdEntities })
  }

  if (Object.keys(labels).length === 0) {
    const title = getFirstClaimValue(claims, 'wdt:P1476')
    const lang = getOriginalLang(claims)
    if (title && lang) {
      labels[lang] = title
    }
  }
  const descriptions = buildDescriptions(claims)

  // Local claims will be preserved in a local layer during merge
  const claimsWithoutLocalClaims = omitLocalClaims(claims)
  const { uri: wdEntityUri } = await createWdEntity({
    labels,
    descriptions,
    claims: claimsWithoutLocalClaims,
    user,
    isAlreadyValidated: true,
  })

  // Caching relations for some hours, as Wikidata Query Service can take some time to update,
  // at the very minimum some minutes, during which the data contributor might be confused
  // by the absence of the entity they just moved to Wikidata in lists generated with the help of the WQS
  await cacheEntityRelations(invEntityUri)

  await mergeEntities({
    userAcct,
    fromUri: invEntityUri,
    toUri: wdEntityUri,
    context: {
      action: 'move-to-wikidata',
    },
  })

  const isbn13h = getFirstClaimValue(claims, 'wdt:P212')
  if (isbn13h) {
    await temporarilyOverrideWdIdAndIsbnCache(wdEntityUri, isbn13h)
    // Refresh isbn specific caches
    await getEntityByUri({ uri: `isbn:${normalizeIsbn(isbn13h)}`, refresh: true })
  }

  try {
    await setReverseClaims(claims, wdEntityUri, user)
  } catch (err) {
    // Setting reverse claims is a nice-to-have but not worth crashing the request if it fails
    logError(err, 'setReverseClaims failed')
  }

  return { uri: wdEntityUri }
}

const rewrite404 = invEntityUri => err => {
  if (err.statusCode === 404) {
    throw newError('entity not found', 400, { invEntityUri })
  } else {
    throw err
  }
}

function buildDescriptions (claims: ExpandedClaims): Descriptions {
  const entityType = getInvEntityType(claims['wdt:P31'])
  if (entityType !== 'edition') return
  let englishDescription = ''
  const publicationYear = getPublicationYear(claims)
  if (publicationYear) englishDescription += publicationYear
  const languagesUris = claims['wdt:P407']?.map(getClaimValue)
  if (isNonEmptyArray(languagesUris)) {
    const languagesLabels = languagesUris.map(getLanguageEnglishLabel).join('-')
    englishDescription += ` ${languagesLabels}`
  }
  englishDescription = `${englishDescription} edition`.trim()
  return {
    en: englishDescription,
  }
}

async function setReverseClaims (claims: ExpandedClaims, wdEntityUri: WdEntityUri, user: User | MinimalRemoteUser) {
  const credentials = getWikidataOAuthCredentials(user)
  const entityType = getInvEntityType(claims['wdt:P31'])
  const newEntityId = unprefixify(wdEntityUri)
  if (entityType === 'edition') {
    for (const workClaim of uniq(claims['wdt:P629'])) {
      const workUri = getClaimValue(workClaim) as EntityValue
      const id = unprefixify(workUri)
      await wdEdit.claim.create({ id, property: 'P747', value: newEntityId }, { credentials })
    }
  }
}
