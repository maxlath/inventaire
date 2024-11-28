import { createInvEntity } from '#controllers/entities/lib/create_inv_entity'
import { getWdEntityLocalLayer } from '#controllers/entities/lib/entities'
import { prefixifyWd } from '#controllers/entities/lib/prefix'
import { updateInvClaim } from '#controllers/entities/lib/update_inv_claim'
import { newError } from '#lib/error/error'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { getUserAccessLevels } from '#lib/user_access_levels'
import type { InvClaimValue, PropertyUri, WdEntityId } from '#types/entity'
import type { SpecialUser, User } from '#types/user'

export async function updateWdEntityLocalClaims (user: User | SpecialUser, wdId: WdEntityId, property: PropertyUri, oldValue: InvClaimValue, newValue: InvClaimValue) {
  if (property === 'invp:P1') {
    throw newError('entity local layer linking property (invp:P1) can not be updated', 400, { wdId, property, oldValue, newValue })
  }
  const localEntityLayer = await getWdEntityLocalLayer(wdId)
  const wdUri = prefixifyWd(wdId)
  if (localEntityLayer) {
    return updateInvClaim(user, localEntityLayer._id, property, oldValue, newValue)
  } else {
    if (oldValue) {
      throw newError('local claim property value not found', 400, { wdId, property, oldValue, newValue })
    }
    const localEntityLayerClaims = {
      'invp:P1': [ wdUri ],
      [property]: [ newValue ],
    }
    const userAccessLevels = getUserAccessLevels(user)
    await createInvEntity({
      claims: localEntityLayerClaims,
      userAcct: getLocalUserAcct(user._id),
      userAccessLevels,
    })
  }
}
