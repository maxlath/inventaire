import { uniqBy, identity, pick, uniq } from 'lodash-es'
import { getEntitiesList } from '#controllers/entities/lib/get_entities_list'
import { getClaimValue, getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { unprefixify } from '#controllers/entities/lib/prefix'
import { workAuthorRelationsProperties } from '#controllers/entities/lib/properties/properties'
import { getReverseClaims } from '#controllers/entities/lib/reverse_claims'
import { dbFactory } from '#db/couchdb/base'
import { mapDoc } from '#lib/couch'
import { newError } from '#lib/error/error'
import { getUrlFromImageHash } from '#lib/images'
import { toIsbn13h } from '#lib/isbn/isbn'
import { emit } from '#lib/radio'
import { assertTypes, assertString } from '#lib/utils/assert_types'
import { beforeEntityDocSave } from '#models/entity'
import config from '#server/config'
import type { EntityUri, InvEntityDoc, EntityValue, PropertyUri, InvEntity, Isbn, InvClaimValue, SerializedEntity, WdEntityId, WdEntityUri, EntityType, Claims, NewInvEntity } from '#types/entity'
import type { EntityImagePath, ImageHash } from '#types/image'
import type { BatchId, PatchContext } from '#types/patch'
import type { AccountUri } from '#types/server'
import { getInvEntityCanonicalUri } from './get_inv_entity_canonical_uri.js'
import { createPatch } from './patches/create_patch.js'
import { validateProperty } from './properties/validations.js'
import type { DocumentViewResponse } from 'blue-cot/types/nano.js'

const federatedMode = config.federation.remoteEntitiesOrigin != null

const db = await dbFactory('entities')

export const getEntityById = db.get<InvEntityDoc>
export const getEntitiesByIds = db.byIds<InvEntityDoc>

export function getInvEntitiesByIsbns (isbns: Isbn[]) {
  const keys = isbns
    .map(toIsbn13h)
    .filter(identity)
    .map(isbn => [ 'wdt:P212', isbn ])
  return db.getDocsByViewKeys<InvEntity>('byClaim', keys)
}

export async function getInvEntityByIsbn (isbn: Isbn) {
  const docs = await getInvEntitiesByIsbns([ isbn ])
  return docs[0]
}

type ByClaimViewKey = [ PropertyUri, InvClaimValue ]

export async function getInvEntitiesByClaim (property: PropertyUri, value: InvClaimValue, includeDocs?: false, parseDoc?: false): Promise<DocumentViewResponse<InvEntity, ByClaimViewKey, EntityValue>>
export async function getInvEntitiesByClaim (property: PropertyUri, value: InvClaimValue, includeDocs?: true, parseDoc?: false): Promise<DocumentViewResponse<InvEntity, ByClaimViewKey, EntityValue>>
export async function getInvEntitiesByClaim (property: PropertyUri, value: InvClaimValue, includeDocs?: true, parseDoc?: true): Promise<InvEntity[]>
export async function getInvEntitiesByClaim (property: PropertyUri, value: InvClaimValue, includeDocs = false, parseDoc = false) {
  validateProperty(property)

  const res = await db.view<InvEntity, ByClaimViewKey, EntityValue>('entities', 'byClaim', {
    key: [ property, value ],
    include_docs: includeDocs,
  })

  if (parseDoc) return mapDoc(res)
  else return res
}

export type ClaimPropertyValueTuple = [ PropertyUri, InvClaimValue ]

export async function getInvEntitiesByClaims (claims: ClaimPropertyValueTuple[]) {
  claims.forEach(([ property ]) => validateProperty(property))
  return db.getDocsByViewKeys<InvEntity>('byClaim', claims)
}

export async function getInvUrisByClaim (property: PropertyUri, value: InvClaimValue) {
  const entities = await getInvEntitiesByClaim(property, value, true, true)
  return entities.map(getInvEntityCanonicalUri)
}

export async function getInvEntitiesUrisByClaims (properties: PropertyUri[], value: InvClaimValue) {
  const claims: ClaimPropertyValueTuple[] = properties.map(property => [ property, value ])
  const entities = await getInvEntitiesByClaims(claims)
  return entities.map(getInvEntityCanonicalUri)
}

export async function getInvClaimsByClaimValue (value: InvClaimValue) {
  const { rows } = await db.view<InvEntity, EntityValue, PropertyUri>('entities', 'byClaimValue', {
    key: value,
    include_docs: false,
  })
  return rows.map(row => ({
    entity: row.id,
    property: row.value,
  }))
}

export async function getInvEntitiesClaimValueCount (value: InvClaimValue) {
  const { rows } = await db.view<InvEntity, EntityValue, PropertyUri>('entities', 'byClaimValue', {
    key: value,
    include_docs: false,
  })
  return rows.length
}

interface PutInvEntityCommonParams {
  userAcct: AccountUri
  batchId?: BatchId
  context?: PatchContext
}
export interface PutInvEntityCreationParams extends PutInvEntityCommonParams {
  currentDoc: NewInvEntity
  updatedDoc: NewInvEntity
  create: true
}
interface PutInvEntityUpdateParams extends PutInvEntityCommonParams {
  currentDoc: InvEntityDoc
  updatedDoc: InvEntityDoc
  create?: false
}
export async function putInvEntityUpdate <T extends InvEntityDoc = InvEntity> (params: PutInvEntityCreationParams | PutInvEntityUpdateParams) {
  const { userAcct, currentDoc, updatedDoc, create, batchId, context } = params
  assertTypes([ 'string', 'object', 'object' ], [ userAcct, currentDoc, updatedDoc ])
  if (currentDoc === updatedDoc) {
    // @ts-expect-error TS2345
    throw newError('currentDoc and updatedDoc can not be the same object', 500, params)
  }

  beforeEntityDocSave(updatedDoc)

  // It is to the consumers responsability to check if there is an update:
  // empty patches at this stage will throw 500 errors
  let docAfterUpdate
  if (create === true) {
    docAfterUpdate = await db.postAndReturn(updatedDoc)
  } else {
    docAfterUpdate = await db.putAndReturn(updatedDoc)
  }

  try {
    const patchCreationParams = {
      userAcct,
      currentDoc,
      updatedDoc: docAfterUpdate as T,
      batchId,
      context,
    }
    const patch = await createPatch(patchCreationParams)
    if (patch) await emit('patch:created', patch)
  } catch (err) {
    const patchErr = newError('patch creation failed', 500, { currentDoc, updatedDoc })
    patchErr.name = 'patch_creation_failed'
    patchErr.cause = err
    throw patchErr
  }

  return docAfterUpdate as T
}

export const getUrlFromEntityImageHash = (imageHash: ImageHash) => getUrlFromImageHash('entities', imageHash) as EntityImagePath

export const uniqByUri = entities => uniqBy(entities, getUri)

export async function imageIsUsed (imageHash: ImageHash) {
  if (federatedMode) return false
  assertString(imageHash)
  const { rows } = await getInvEntitiesByClaim('invp:P2', imageHash)
  return rows.length > 0
}

const getUri = entity => entity.uri

export const termsFromClaimsTypes = [ 'edition', 'collection' ] satisfies EntityType[]

export function setTermsFromClaims (entity: SerializedEntity) {
  const title = getFirstClaimValue(entity.claims, 'wdt:P1476')
  const subtitle = getFirstClaimValue(entity.claims, 'wdt:P1680')
  if (title) {
    entity.labels = entity.labels || {}
    entity.labels.fromclaims = title
  }
  if (subtitle) {
    entity.descriptions = entity.descriptions || {}
    entity.descriptions.fromclaims = subtitle
  }
}

export function getAggregatedPropertiesValues (claims: Claims, properties: PropertyUri[]) {
  return uniq(Object.values(pick(claims, properties)).flat().map(getClaimValue))
}

export function getWorksAuthorsUris (works: SerializedEntity[]) {
  const uris: EntityUri[] = works.map(getWorkAuthorsUris).flat()
  return uniq(uris)
}

function getWorkAuthorsUris (work: SerializedEntity) {
  return Object.values(pick(work.claims, workAuthorRelationsProperties)).flat()
}

export async function getWdEntitiesLocalLayers (wdIds: WdEntityId[]) {
  const keys = wdIds.map(wdId => [ 'invp:P1', `wd:${wdId}` ])
  const docs = await db.getDocsByViewKeys<InvEntity>('byClaim', keys)
  const docsByWdId: Record<WdEntityId, InvEntity> = {}
  for (const doc of docs) {
    const id = unprefixify(getFirstClaimValue(doc.claims, 'invp:P1'))
    docsByWdId[id] = doc
  }
  return docsByWdId
}

export async function getWdEntityLocalLayer (wdId: WdEntityId) {
  const res = await db.view<InvEntity, ByClaimViewKey, EntityValue>('entities', 'byClaim', {
    key: [ 'invp:P1', `wd:${wdId}` ],
    include_docs: true,
  })
  return res.rows[0]?.doc
}

export async function wdEntityHasALocalLayer (wdUri: WdEntityUri) {
  const wdId = unprefixify(wdUri)
  const localLayer = await getWdEntityLocalLayer(wdId)
  return localLayer != null
}

export async function getWorkEditions (workUri: EntityUri) {
  const editionsUris = await getReverseClaims({ property: 'wdt:P629', value: workUri })
  return getEntitiesList(editionsUris)
}

export async function getCollectionEditions (workUri: EntityUri) {
  const editionsUris = await getReverseClaims({ property: 'wdt:P195', value: workUri })
  return getEntitiesList(editionsUris)
}

export async function getAuthorsFromWorksUris (workUris: EntityUri[]) {
  const works = await getEntitiesList(workUris)
  const authorsUris = getWorksAuthorsUris(works)
  return getEntitiesList(authorsUris)
}

export async function getPublishersFromPublicationsUris (publicationUris: EntityUri[]) {
  const publications = await getEntitiesList(publicationUris)
  const publishersUris = uniq(publications.flatMap(getPublishersUris))
  return getEntitiesList(publishersUris)
}

function getPublishersUris (publication: SerializedEntity) {
  return publication.claims['wdt:P123']
}
