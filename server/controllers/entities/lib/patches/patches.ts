import { map } from 'lodash-es'
import { dbFactory } from '#db/couchdb/base'
import { maxKey } from '#lib/couch'
import { oneDay } from '#lib/time'
import { assertNumber } from '#lib/utils/assert_types'
import { objectEntries, simpleDay } from '#lib/utils/base'
import { addVersionsSnapshots } from '#models/patch'
import type { EntityUri, InvClaimValue, InvEntityId } from '#types/entity'
import type { Patch, PatchId } from '#types/patch'
import type { UserId } from '#types/user'
import type { ViewKey } from 'blue-cot/types/types.js'

const designDocName = 'patches'

export const db = await dbFactory('patches', designDocName)

export const getPatchById = (id: PatchId) => db.get<Patch>(id)

export async function getPatchesByEntityId (entityId: InvEntityId) {
  const { rows } = await db.view<Patch>(designDocName, 'byEntityId', {
    startkey: [ entityId, 0 ],
    endkey: [ entityId, maxKey ],
    include_docs: true,
  })
  return map(rows, 'doc')
}

export async function getEntityLastPatches (entityId: InvEntityId, length: number = 1) {
  const { rows } = await db.view<Patch>(designDocName, 'byEntityId', {
    startkey: [ entityId, maxKey ],
    endkey: [ entityId, 0 ],
    descending: true,
    include_docs: true,
    limit: length,
  })
  return map(rows, 'doc')
}

export async function getPatchesByDate ({ limit, offset }: { limit: number, offset: number }) {
  const viewRes = await db.view<Patch>(designDocName, 'byDate', {
    limit,
    skip: offset,
    descending: true,
    include_docs: true,
  })
  return formatPatchesPage(viewRes, limit, offset)
}

export async function getPatchesByUserId ({ userId, limit, offset }: { userId: UserId, limit: number, offset: number }) {
  const [ viewRes, total ] = await Promise.all([
    db.view<Patch>(designDocName, 'byUserIdAndDate', {
      startkey: [ userId, maxKey ],
      endkey: [ userId ],
      descending: true,
      limit,
      skip: offset,
      include_docs: true,
      reduce: false,
    }),
    // Unfortunately, the response doesn't gives the total range length
    // so we need to query it separately
    getUserContributionsCount(userId),
  ])

  return formatPatchesPage(viewRes, limit, offset, total)
}

export async function getPatchesByUserIdAndFilter ({ userId, filter, limit, offset }: { userId: UserId, filter: string, limit: number, offset: number }) {
  const [ viewRes, total ] = await Promise.all([
    db.view<Patch>(designDocName, 'byUserIdAndFilterAndDate', {
      startkey: [ userId, filter, maxKey ],
      endkey: [ userId, filter ],
      descending: true,
      limit,
      skip: offset,
      include_docs: true,
      reduce: false,
    }),
    // Unfortunately, the response doesn't gives the total range length
    // so we need to query it separately
    getUserPropertyContributionsCount(userId, filter),
  ])

  return formatPatchesPage(viewRes, limit, offset, total)
}

export function getPatchesByRedirectUri (uri: EntityUri) {
  return db.getDocsByViewKey<Patch>('byRedirectUri', uri)
}

export async function getPatchesWithSnapshots (entityId: InvEntityId) {
  const patches = await getPatchesByEntityId(entityId)
  addVersionsSnapshots(patches)
  return patches
}

export async function getGlobalContributions () {
  const { rows } = await db.view<Patch>(designDocName, 'byUserIdAndDate', { group_level: 1 })
  return sortAndFilterContributions(rows.map(formatRow))
  // Return only the first hundred results
  .slice(0, 100)
}

export function getContributionsFromLastDay (days: number) {
  assertNumber(days)
  const now = Date.now()
  const startTime = now - (oneDay * days)
  const today = simpleDay()
  const startDay = simpleDay(startTime)
  return db.view<Patch>(designDocName, 'byDay', {
    group_level: 2,
    startkey: [ startDay ],
    endkey: [ today, maxKey ],
  })
  .then(({ rows }) => rows)
  .then(rows => convertToArray(rows.reduce(aggregatePeriodContributions, {})))
  .then(contributions => ({
    contributions,
    start: startDay,
    end: today,
  }))
}

export async function getPatchesByClaimValue (claimValue: InvClaimValue, offset: number, limit: number) {
  const { rows } = await db.view<Patch>(designDocName, 'byClaimValueAndDate', {
    startkey: [ claimValue, maxKey ],
    endkey: [ claimValue ],
    descending: true,
    reduce: false,
    skip: offset,
    limit,
  })
  return rows
}

export async function getPatchesCountByClaimValue (claimValue: InvClaimValue) {
  const { rows } = await db.view<Patch>(designDocName, 'byClaimValueAndDate', {
    startkey: [ claimValue, maxKey ],
    endkey: [ claimValue ],
    group_level: 1,
    descending: true,
  })
  return (rows[0]?.value || 0) as number
}

const formatRow = row => ({
  user: row.key[0],
  contributions: row.value,
})

function aggregatePeriodContributions (counts: Record<UserId, number>, row) {
  const userId = row.key[1]
  const contributions = row.value
  if (counts[userId] == null) counts[userId] = 0
  counts[userId] += contributions
  return counts
}

export interface UserContributionCount {
  user: UserId
  contributions: number
}
function convertToArray (counts: Record<UserId, number>) {
  const data = objectEntries(counts)
    .map(([ userId, contributions ]) => ({ user: userId, contributions }))
  return sortAndFilterContributions(data)
}

function sortAndFilterContributions (userContributionCounts: UserContributionCount[]) {
  return userContributionCounts
  .filter(noSpecialUser)
  .sort((a, b) => b.contributions - a.contributions)
}

// Filtering-out special users automated contributions
// see server/db/couchdb/hard_coded_documents.js
const noSpecialUser = row => !row.user.startsWith('000000000000000000000000000000')

function getUserContributionsCount (userId: UserId) {
  return getRangeLength({
    viewName: 'byUserIdAndDate',
    startkey: [ userId ],
    endkey: [ userId, maxKey ],
  })
}

function getUserPropertyContributionsCount (userId: UserId, filter) {
  return getRangeLength({
    viewName: 'byUserIdAndFilterAndDate',
    startkey: [ userId, filter ],
    endkey: [ userId, filter, maxKey ],
  })
}

async function getRangeLength ({ viewName, startkey, endkey }) {
  const { rows } = await db.view<Patch, ViewKey>(designDocName, viewName, {
    group_level: startkey.length,
    startkey,
    endkey,
  })
  return (rows[0] != null ? rows[0].value : 0) as number
}

export interface PatchesPage {
  patches: Patch[]
  total: number
  continue?: number
}

function formatPatchesPage (viewRes, limit, offset, total?: number) {
  if (total == null) total = viewRes.total_rows
  const data: PatchesPage = {
    patches: map(viewRes.rows, 'doc'),
    total,
  }
  const rangeEnd = offset + limit
  if (rangeEnd < total) data.continue = rangeEnd
  return data
}
