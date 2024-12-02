import { expandInvClaims } from '#controllers/entities/lib/inv_claims_utils'
import { parseReqLocalOrRemoteUser } from '#lib/federation/remote_user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq } from '#types/server'
import { createInvEntity } from './lib/create_inv_entity.js'
import { createWdEntity } from './lib/create_wd_entity.js'
import { getEntityByUri } from './lib/get_entity_by_uri.js'

const sanitization = {
  labels: {
    generic: 'object',
    default: {},
  },
  claims: {
    generic: 'object',
  },
  prefix: {
    allowlist: [ 'inv', 'wd' ],
    default: 'inv',
  },
}

async function controller (params: SanitizedParameters, req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  const { prefix, labels, claims, reqUserAcct } = params
  let entity
  if (prefix === 'wd') {
    entity = await createWdEntity({
      labels,
      claims: expandInvClaims(claims),
      user: parseReqLocalOrRemoteUser(req),
    })
  } else {
    entity = await createInvEntity({
      labels,
      claims,
      userAcct: reqUserAcct,
    })
  }
  // Re-request the entity's data to get it formatted
  return getEntityByUri({ uri: entity.uri, refresh: true })
}

export default {
  sanitization,
  controller,
  track: [ 'entity', 'creation' ],
}
