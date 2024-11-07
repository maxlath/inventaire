import { values } from 'lodash-es'
import { forceArray } from '#lib/utils/base'
import type { EntityType } from '#server/types/entity'
import type { Url } from '#types/common'
import { publicReq, adminReq } from './utils.js'

export const endpoint: Url = '/api/tasks?action='

export async function getByIds (ids) {
  ids = forceArray(ids).join('|')
  const { tasks } = await publicReq('get', `${endpoint}by-ids&ids=${ids}`)
  return tasks
}

export async function getBySuspectUris (uris, type = 'deduplicate') {
  uris = forceArray(uris).join('|')
  const { tasks } = await publicReq('get', `${endpoint}by-uris&uris=${uris}&type=${type}`)
  return tasks
}

export async function getBySuspectUri (uri, type = 'deduplicate') {
  const obj = await getBySuspectUris(uri, type)
  return obj[uri]
}

export async function getBySuggestionUris (uris, type = 'deduplicate') {
  uris = forceArray(uris).join('|')
  const { tasks } = await publicReq('get', `${endpoint}by-suggestion-uris&uris=${uris}&type=${type}`)
  return tasks
}

export async function getByScore ({ limit, offset }: { limit?: number, offset?: number }) {
  let url: Url = `${endpoint}by-score`
  if (limit != null) url += `&limit=${limit}`
  if (offset != null) url += `&offset=${offset}`
  const { tasks } = await publicReq('get', url)
  return tasks
}

export async function getByEntitiesType ({ type, entitiesType, limit, offset }: { type: any, entitiesType: EntityType, limit?: number, offset?: number }) {
  let url: Url = `${endpoint}by-entities-type&type=${type}&entities-type=${entitiesType}`
  if (limit != null) url += `&limit=${limit}`
  if (offset != null) url += `&offset=${offset}`
  const { tasks } = await publicReq('get', url)
  return tasks
}

export function update (id, attribute?: string, value?: string) {
  return adminReq('put', `${endpoint}update`, { id, attribute, value })
}

export async function checkEntities (uris) {
  uris = forceArray(uris)
  await adminReq('post', `${endpoint}check-human-duplicates`, { uris })
  const getTasksBySuspectUris = await getBySuspectUris(uris)
  return values(getTasksBySuspectUris).flat()
}
