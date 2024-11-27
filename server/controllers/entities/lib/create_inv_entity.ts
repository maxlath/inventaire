import { cloneDeep } from 'lodash-es'
import { putInvEntityUpdate, type PutInvEntityCreationParams } from '#controllers/entities/lib/entities'
import type { AccessLevel } from '#lib/user_access_levels'
import { log, success } from '#lib/utils/logs'
import { addEntityDocClaims, createBlankEntityDoc, setEntityDocLabels } from '#models/entity'
import type { InvEntity } from '#types/entity'
import type { BatchId } from '#types/patch'
import type { AccountUri } from '#types/server'
import { prefixifyInv } from './prefix.js'
import { validateInvEntity } from './validate_entity.js'

interface CreateInvEntityParams {
  labels?: InvEntity['labels']
  claims: InvEntity['claims']
  userAcct: AccountUri
  batchId?: BatchId
  userAccessLevels?: AccessLevel[]
}

export async function createInvEntity (params: CreateInvEntityParams) {
  const { labels = {}, claims, userAcct, batchId, userAccessLevels } = params
  log(params, 'inv entity creation')

  await validateInvEntity({ labels, claims }, userAccessLevels)

  const currentDoc = createBlankEntityDoc()
  let updatedDoc = cloneDeep(currentDoc)
  updatedDoc = setEntityDocLabels(updatedDoc, labels)
  updatedDoc = addEntityDocClaims(updatedDoc, claims)
  const updateParams = { userAcct, currentDoc, updatedDoc, batchId, create: true } as PutInvEntityCreationParams
  const createdEntity = await putInvEntityUpdate(updateParams)
  // @ts-expect-error
  createdEntity.uri = prefixifyInv(createdEntity._id)
  // @ts-expect-error
  success(`inv entity created: ${createdEntity.uri}`)
  return createdEntity
}
