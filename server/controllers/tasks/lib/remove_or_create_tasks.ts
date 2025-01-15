import { pick, omit } from 'lodash-es'
import { getEntitiesByUris } from '#controllers/entities/lib/get_entities_by_uris'
import { externalIdsProperties } from '#controllers/entities/lib/properties/properties_values_constraints'
import { removeEntitiesByInvId } from '#controllers/entities/lib/remove_entities_by_inv_id'
import { getClaimsWithThisUri, verifyThatEntitiesCanBeRemoved } from '#controllers/entities/lib/verify_that_entities_can_be_removed'
import { getClaimsValuesUris, updateTasks, getTasksBySuspectUris, createTasksInBulk } from '#controllers/tasks/lib/tasks'
import { isNonEmptyArray, isNonEmptyPlainObject } from '#lib/boolean_validations'
import type { UserWithAcct } from '#lib/federation/remote_user'
import { log } from '#lib/utils/logs'
import type { EntityUri } from '#types/entity'

export async function removeOrCreateOrUpdateTasks (user: UserWithAcct, uris: EntityUri[]) {
  const [ entitiesRes, existingTasks ] = await Promise.all([
    getEntitiesByUris({ uris }),
    getTasksBySuspectUris(uris, { index: true }),
  ])
  const { acct: userAcct } = user

  const tasksIdsToUpdate = []
  const tasksToCreate = []
  const entitiesUrisToRemove = []

  async function assignActions () {
    const uri = uris.pop()
    if (uri == null) return

    const entity = entitiesRes.entities[uri]
    if (entity == null) return assignActions()

    const { type: entitiesType, claims } = entity
    let isTask

    const externalClaims = await getClaimsWithThisUri(uri)
    if (externalClaims.length > 0) isTask = true

    delete claims['wdt:P31']
    const claimsUris = getClaimsValuesUris(omit(claims, [ 'wdt:P31' ]))
    if (isNonEmptyArray(claimsUris)) isTask = true

    const entityExternalIdsProperties = pick(claims, externalIdsProperties)
    if (isNonEmptyPlainObject(entityExternalIdsProperties)) isTask = true

    if (isTask) {
      if (isNonEmptyArray(existingTasks[uri])) {
        const task = existingTasks[uri][0]
        tasksIdsToUpdate.push(task._id)
      } else {
        tasksToCreate.push(buildCreateTask(uri, entitiesType, userAcct))
      }
    } else {
      entitiesUrisToRemove.push(uri)
    }
    return assignActions()
  }
  await assignActions()

  if (isNonEmptyArray(tasksIdsToUpdate)) {
    log({ tasksIdsToUpdate }, 'add reporter to tasks')
    await updateTasks({
      ids: tasksIdsToUpdate,
      attribute: 'reporter',
      newValue: userAcct,
    })
  }
  if (isNonEmptyArray(tasksToCreate)) {
    log({ tasksToCreate }, 'creating tasks')
    await createTasksInBulk(tasksToCreate)
  }
  if (isNonEmptyArray(entitiesUrisToRemove)) {
    log({ entitiesUrisToRemove }, 'removing tasks')
    await verifyThatEntitiesCanBeRemoved(entitiesUrisToRemove)
    await removeEntitiesByInvId(user, entitiesUrisToRemove)
  }
  return {
    ok: true,
  }
}

function buildCreateTask (suspectUri, entitiesType, userAcct) {
  return {
    type: 'delete',
    entitiesType,
    suspectUri,
    reporter: userAcct,
  }
}
