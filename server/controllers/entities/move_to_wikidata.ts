import { isInvEntityUri } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { parseReqLocalOrRemoteUser } from '#lib/federation/remote_user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq } from '#types/server'
import { moveInvEntityToWikidata } from './lib/move_to_wikidata.js'

const sanitization = {
  uri: {},
}

async function controller (params: SanitizedParameters, req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  const { uri } = params
  if (!isInvEntityUri(uri)) throw newError('Expected an inv entity uri', 400, { uri })
  const user = parseReqLocalOrRemoteUser(req)
  return moveInvEntityToWikidata(user, uri)
}

export default {
  sanitization,
  controller,
  track: [ 'entity', 'moveToWikidata' ],
}
