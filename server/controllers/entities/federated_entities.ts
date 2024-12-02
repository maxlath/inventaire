import { makeActorKeyUrl } from '#controllers/activitypub/lib/get_actor'
import { signRequest } from '#controllers/activitypub/lib/security'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'
import { localEntitiesControllersParams } from '#controllers/entities/entities'
import { verbAndActionsControllersFactory } from '#lib/actions_controllers'
import { isAuthentifiedReq } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { newUnauthorizedApiAccessError } from '#lib/error/pre_filled'
import { instanceActorName } from '#lib/federation/instance'
import { remoteUserHeader } from '#lib/federation/remote_user'
import { requests_ } from '#lib/requests'
import type { AccessLevel } from '#lib/user_access_levels'
import { objectEntries } from '#lib/utils/base'
import config from '#server/config'
import type { AbsoluteUrl } from '#types/common'
import type { ActionController, HttpVerb } from '#types/controllers'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, Req } from '#types/server'

const { remoteEntitiesOrigin } = config.federation

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
  let sanitization, track
  if (typeof actionController !== 'function') {
    ;({ sanitization, track } = actionController)
  }

  async function controller (params: SanitizedParameters, req: Req | AuthentifiedReq) {
    const remoteUrl = `${remoteEntitiesOrigin}${req.url}` as AbsoluteUrl
    const body = (verb === 'get' || verb === 'delete') ? undefined : req.body
    if (accessLevel === 'public') {
      try {
        return await requests_[verb](remoteUrl, { body })
      } catch (err) {
        throw forwardRemoteError(err)
      }
    } else if (isAuthentifiedReq(req)) {
      try {
        return await signedProxyRequest(req, verb, remoteUrl, body)
      } catch (err) {
        throw forwardRemoteError(err)
      }
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

function forwardRemoteError (err: ContextualizedError) {
  const { statusCode } = err
  // @ts-expect-error
  const { status_verbose: message, context } = err.body
  const repackedError = newError(message, statusCode, context)
  return repackedError
}

export const federatedEntitiesControllers = verbAndActionsControllersFactory(federatedEntitiesControllersParams)
