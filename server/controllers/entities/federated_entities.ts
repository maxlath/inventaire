import { pick } from 'lodash-es'
import { makeActorKeyUrl } from '#controllers/activitypub/lib/get_actor'
import { signRequest } from '#controllers/activitypub/lib/security'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'
import { localEntitiesControllersParams } from '#controllers/entities/entities'
import { verbAndActionsControllersFactory } from '#lib/actions_controllers'
import { isAuthentifiedReq } from '#lib/boolean_validations'
import { newUnauthorizedApiAccessError } from '#lib/error/pre_filled'
import { instanceActorName } from '#lib/federation/instance'
import { remoteUserHeader } from '#lib/federation/remote_user'
import { requests_ } from '#lib/requests'
import type { AccessLevel } from '#lib/user_access_levels'
import { objectEntries } from '#lib/utils/base'
import { buildUrl } from '#lib/utils/url'
import config from '#server/config'
import type { AbsoluteUrl } from '#types/common'
import type { ActionController, HttpVerb } from '#types/controllers'
import type { AuthentifiedReq, Req } from '#types/server'

const { remoteEntitiesOrigin } = config.federation
const remoteEntitiesEndpoint: AbsoluteUrl = `${remoteEntitiesOrigin}/api/entities`

// Use-cases for duplicating remote endpoints locally:
// - proxy read controllers to keep a local cache and trigger hooks
// - proxy write controllers to handle authenfication
// Note that requests requiring Wikidata OAuth could possibly be replaced by request
// authentified with a server Wikidata account
const federatedEntitiesControllersParams = {}

for (const [ verb, verbParams ] of objectEntries(localEntitiesControllersParams)) {
  federatedEntitiesControllersParams[verb] = {}
  for (const [ accessLevel, actionControllers ] of objectEntries(verbParams)) {
    if (accessLevel === 'public' || accessLevel === 'authentified') {
      federatedEntitiesControllersParams[verb][accessLevel] = {}
      for (const [ actionName, actionController ] of objectEntries(actionControllers)) {
        const controller = proxiedController(accessLevel, verb, actionName as string, actionController)
        federatedEntitiesControllersParams[verb][accessLevel][actionName] = controller
      }
    }
  }
}

function proxiedController (accessLevel: AccessLevel, verb: HttpVerb, action: string, actionController: ActionController) {
  let sanitization, track, transferableParams
  if (typeof actionController !== 'function') {
    ;({ sanitization, track } = actionController)
    transferableParams = sanitization ? Object.keys(sanitization) : []
  }
  async function controller (params: Record<string, unknown>, req: Req | AuthentifiedReq) {
    let remoteUrl, body
    // Drop sanitization built parameters (ex: reqUserId)
    if (params) params = pick(params, transferableParams)
    if (verb === 'get' || verb === 'delete') {
      remoteUrl = buildUrl(remoteEntitiesEndpoint, { action, ...params })
    } else {
      remoteUrl = buildUrl(remoteEntitiesEndpoint, { action })
      body = params
    }
    if (accessLevel === 'public') {
      return requests_[verb](remoteUrl, { body })
    } else if (isAuthentifiedReq(req)) {
      return signedProxyRequest(req, verb, remoteUrl, body)
    } else {
      throw newUnauthorizedApiAccessError(401)
    }
  }
  if (typeof actionController === 'function') {
    return controller
  } else {
    // Sanitize locally before proxying
    return { controller, sanitization, track }
  }
}

async function signedProxyRequest (req: AuthentifiedReq, verb: HttpVerb, remoteUrl: AbsoluteUrl, body: unknown) {
  const { _id: userId } = req.user
  const { privateKey, publicKeyHash } = await getSharedKeyPair()
  const headers = signRequest({
    url: remoteUrl,
    method: verb,
    keyId: makeActorKeyUrl(instanceActorName, publicKeyHash),
    privateKey,
    body,
    headers: {
      [remoteUserHeader]: userId,
    },
  })
  return requests_[verb](remoteUrl, { headers, body })
}

export const federatedEntitiesControllers = verbAndActionsControllersFactory(federatedEntitiesControllersParams)
