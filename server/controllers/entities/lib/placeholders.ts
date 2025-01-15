// Placeholders are entities automatically created without checking that a similar
// entity existed locally or in Wikidata. Those entities have thus high chances
// to be duplicates and to be deleted by merge operations.

// But mistakes happen, and some merges will need to be reverted:
// thus the remove/recover mechanism hereafter

import { putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { dbFactory } from '#db/couchdb/base'
import { emit } from '#lib/radio'
import { warn } from '#lib/utils/logs'
import { convertEntityDocToPlaceholder, recoverEntityDocFromPlaceholder } from '#models/entity'
import type { InvEntityDoc, InvEntityId, RemovedPlaceholderEntity } from '#types/entity'
import type { UserAccountUri } from '#types/server'

const db = await dbFactory('entities')

function PlaceholderHandler (actionName, modelFn) {
  return async (userAcct: UserAccountUri, entityId: InvEntityId) => {
    warn(entityId, `${actionName} placeholder entity`)
    // Using db.get anticipates a possible future where db.byId filters-out
    // non type='entity' docs, thus making type='removed:placeholder' not accessible
    const currentDoc = await db.get<InvEntityDoc>(entityId)
    if (actionName === 'remove' && currentDoc.type === 'removed:placeholder') {
      warn(entityId, 'this entity is already a removed:placeholder: ignored')
      return
    }
    let updatedDoc
    try {
      updatedDoc = modelFn(currentDoc)
    } catch (err) {
      if (err.message === "can't turn a redirection into a removed placeholder") {
        // Ignore this error as the effects of those two states are close
        // (so much so that it might be worth just having redirections)
        warn(currentDoc, err.message)
        return
      } else {
        throw err
      }
    }

    await putInvEntityUpdate<RemovedPlaceholderEntity>({ userAcct, currentDoc, updatedDoc })
    await emit(`entity:${actionName}`, `inv:${entityId}`)
    return currentDoc._id
  }
}

export const removePlaceholder = PlaceholderHandler('remove', convertEntityDocToPlaceholder)
export const recoverPlaceholder = PlaceholderHandler('recover', recoverEntityDocFromPlaceholder)
