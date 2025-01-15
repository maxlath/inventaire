import { property, uniq } from 'lodash-es'
import { getEntitiesByUris } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getShelvesByIds } from '#controllers/shelves/lib/shelves'
import { isNonEmptyArray } from '#lib/boolean_validations'
import { addErrorContext, newError } from '#lib/error/error'
import { flatMapUniq, mapUniq } from '#lib/utils/base'
import { validateVisibilityKeys } from '#lib/visibility/visibility'

const allowlistedEntityTypes = new Set([ 'edition', 'work' ])

export async function validateItemsAsync (items) {
  const owners = mapUniq(items, 'owner')
  if (owners.length !== 1) {
    throw newError('items should belong to a unique owner', 500, { items })
  }
  const userId = owners[0]
  const shelvesIds = flatMapUniq(items, 'shelves')
  const visibilityKeys = flatMapUniq(items, 'visibility')

  await Promise.all([
    validateEntities(items),
    validateShelves(userId, shelvesIds),
    validateVisibilityKeys(visibilityKeys, userId),
  ])
  .catch(err => {
    addErrorContext(err, { userId, items })
    throw err
  })
}

async function validateEntities (items) {
  const uris = mapUniq(items, 'entity')
  const { entities, redirects, notFound } = await getEntitiesByUris({ uris })
  if (notFound?.length > 0) {
    throw newError('some entities could not be found', 400, { uris, notFound })
  }
  if (redirects && Object.keys(redirects).length > 0) {
    throw newError('some entities are redirections', 400, { redirects })
  }
  Object.values(entities).forEach(validateEntityType)
}

function validateEntityType (entity) {
  const { type } = entity
  if (!allowlistedEntityTypes.has(type)) {
    throw newError('invalid entity type', 400, { type })
  }
}

export async function validateShelves (userId, shelvesIds) {
  const shelves = await getShelvesByIds(shelvesIds)
  validateShelvesOwnership(userId, shelves)
}

function validateShelvesOwnership (userId, shelves) {
  if (isNonEmptyArray(shelves)) {
    const shelvesOwners = shelves.map(property('owner'))
    const allShelvesBelongToUser = uniq(shelvesOwners)[0] === userId

    if (!allShelvesBelongToUser) {
      throw newError('invalid owner', 400, { userId })
    }
  }
}
