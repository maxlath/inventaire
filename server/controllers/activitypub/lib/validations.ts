import { getEntityByUri } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getShelfById } from '#controllers/shelves/lib/shelves'
import { findUserByUsername, getUserById } from '#controllers/user/lib/user'
import { isCouchUuid } from '#lib/boolean_validations'
import { notFoundError, newError } from '#lib/error/error'
import type { SerializedEntity } from '#types/entity'
import { getEntityUriFromActorName } from './helpers.js'

export async function validateShelf (name) {
  const id = name.split('-')[1]
  if (!isCouchUuid(id)) throw newError('invalid shelf id', 400, { id })
  const shelf = await getShelfById(id)
  if (!shelf || !shelf.visibility.includes('public')) throw notFoundError({ name })
  const owner = await getUserById(shelf.owner)
  if (!owner) throw notFoundError({ name })
  if (!owner.fediversable) throw newError("shelf's owner is not on the fediverse", 404, { name })
  return { shelf, owner }
}

export async function validateUser (username) {
  const user = await findUserByUsername(username)
  if (!user) throw notFoundError({ username })
  if (!user.fediversable) throw newError('user is not on the fediverse', 404, { username })
  return { user }
}

export async function validateEntity (name) {
  const uri = getEntityUriFromActorName(name)
  const entity: SerializedEntity = await getEntityByUri({ uri })
  if (!entity) throw notFoundError({ uri })
  return { entity }
}
