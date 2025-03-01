import { compact, map, partition, values, zip } from 'lodash-es'
import type { GetEntitiesByUrisResponse } from '#controllers/entities/by_uris_get'
import type { GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import type { GetEntityByUriArgs } from '#controllers/entities/lib/get_entity_by_uri'
import type { ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import type { GetReverseClaimsResponse } from '#controllers/entities/reverse_claims'
import { cache_ } from '#lib/cache'
import { newError } from '#lib/error/error'
import { updateEntitiesRevisionsCache } from '#lib/federation/entities_revisions_cache'
import { federatedRequest } from '#lib/federation/federated_requests'
import { radio } from '#lib/radio'
import { objectFromEntries, objectValues } from '#lib/utils/base'
import { info, logError } from '#lib/utils/logs'
import { buildUrl } from '#lib/utils/url'
import type { EntityUri, MaybeExpandedSerializedEntity, SerializedEntitiesByUris, SerializedEntity } from '#types/entity'

const emitterName = 'remote:entity'

export async function getRemoteEntitiesByUris ({ uris, refresh }: Pick<GetEntitiesByUrisParams, 'uris' | 'refresh'>) {
  uris = compact(uris)
  if (uris.length === 0) return { entities: {}, redirects: {} } satisfies GetEntitiesByUrisResponse

  let notCachedUris: EntityUri[]
  let cachedEntities: SerializedEntitiesByUris
  if (refresh) {
    notCachedUris = uris
    cachedEntities = {}
  } else {
    const cacheKeys = uris.map(getCacheKey)
    const cachedValues = await cache_.dryGetMany(cacheKeys)
    const parsedCachedValues = cachedValues.map(stringifiedValue => stringifiedValue != null ? JSON.parse(stringifiedValue) : null)
    const uriAndEntityEntries = zip(uris, parsedCachedValues)
    const [ cached, notCached ] = partition(uriAndEntityEntries, ([ , cachedValue ]) => cachedValue != null)
    cachedEntities = objectFromEntries(cached) as SerializedEntitiesByUris
    const cachedUris = map(cached, '0')
    notCachedUris = map(notCached, '0')
    if (cachedUris.length > 0) info(`remote entities found in cache: ${cachedUris.join('|')}`)
    if (notCachedUris.length > 0) info(`remote entities fetched: ${notCachedUris.join('|')}`)
  }

  if (notCachedUris.length > 0) {
    const remoteUrl = buildUrl('/api/entities', { action: 'by-uris', uris: notCachedUris.join('|') })
    const res = await federatedRequest<GetEntitiesByUrisResponse>('get', remoteUrl)
    await updateEntitiesRevisionsCache(res, emitterName)

    const cacheBatch = values(res.entities).map(buildPutOperation)
    await cache_.batch(cacheBatch)
    Object.assign(res.entities, cachedEntities)
    return res
  } else {
    return { entities: cachedEntities, redirects: {} } satisfies GetEntitiesByUrisResponse
  }
}

function buildPutOperation (entity: MaybeExpandedSerializedEntity) {
  return {
    type: 'put',
    key: getCacheKey(entity.uri),
    value: JSON.stringify(entity),
  }
}

const getCacheKey = (uri: EntityUri) => `remote:entity:${uri}`

export async function getRemoteEntitiesList (uris: EntityUri[], params: Partial<Pick<GetEntitiesByUrisParams, 'refresh'>> = {}) {
  uris = compact(uris)
  if (uris.length === 0) return [] as SerializedEntity[]
  const { entities } = await getRemoteEntitiesByUris({ uris, ...params })
  return objectValues(entities)
}

export async function getRemoteEntityByUri ({ uri, refresh }: GetEntityByUriArgs) {
  const [ entity ] = await getRemoteEntitiesList([ uri ], { refresh })
  if (entity) return entity
  else throw newError('entity not found', 404, { uri })
}

export async function getRemoteReverseClaims (params: ReverseClaimsParams) {
  const remoteUrl = buildUrl('/api/entities', { action: 'reverse-claims', ...params })
  const { uris } = await federatedRequest<GetReverseClaimsResponse>('get', remoteUrl)
  return uris
}

radio.on('entity:changed', async (uri: EntityUri, emitter?: string) => {
  try {
    // Check the emitter to not bust the cache when the emitter is getRemoteEntitiesByUris itself
    // as the cache would then already be up-to-date
    if (emitter !== emitterName) {
      await cache_.delete(getCacheKey(uri))
      info(`remote entity cache invalidation: ${uri}`)
    }
  } catch (err) {
    logError(err, 'remote entity cache invalidation error')
  }
})
