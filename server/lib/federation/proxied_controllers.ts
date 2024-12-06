import { makeActorKeyUrl } from '#controllers/activitypub/lib/get_actor'
import { signRequest } from '#controllers/activitypub/lib/security'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'
import { methodAndActionsControllersFactory } from '#lib/actions_controllers'
import { isAuthentifiedReq } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { newUnauthorizedApiAccessError } from '#lib/error/pre_filled'
import { instanceActorName } from '#lib/federation/instance'
import { remoteUserHeader } from '#lib/federation/remote_user'
import { requests_ } from '#lib/requests'
import type { AccessLevel } from '#lib/user_access_levels'
import { arrayIncludes, objectEntries } from '#lib/utils/base'
import config from '#server/config'
import type { AbsoluteUrl, RelativeUrl } from '#types/common'
import type { ActionController, HttpMethod, MethodsAndActionsControllers } from '#types/controllers'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, Req } from '#types/server'

const { remoteEntitiesOrigin } = config.federation

function proxiedController (accessLevel: AccessLevel, method: HttpMethod, pathname: RelativeUrl, action: string, actionController: ActionController) {
  if (accessLevel === 'admin' || accessLevel === 'dataadmin') return closedEndpointFactory(method, pathname, action)
  let sanitization, track
  if (typeof actionController !== 'function') {
    ;({ sanitization, track } = actionController)
  }

  async function controller (params: SanitizedParameters, req: Req | AuthentifiedReq) {
    const remoteUrl = `${remoteEntitiesOrigin}${req.url}` as AbsoluteUrl
    const body = (method === 'get' || method === 'delete') ? undefined : req.body
    if (isAuthentifiedReq(req)) {
      try {
        return await signedProxyRequest(req, method, remoteUrl, body)
      } catch (err) {
        throw forwardRemoteError(err, remoteUrl)
      }
    } else if (accessLevel === 'public') {
      try {
        return await requests_[method](remoteUrl, { body })
      } catch (err) {
        throw forwardRemoteError(err, remoteUrl)
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

function closedEndpointFactory (method: HttpMethod, pathname: RelativeUrl, action: string) {
  return function closedEndpointController () {
    throw newError('This endpoint is closed in federated mode', 400, { endpoint: `${method.toUpperCase()} ${pathname}?action=${action}` })
  }
}

async function signedProxyRequest (req: AuthentifiedReq, method: HttpMethod, remoteUrl: AbsoluteUrl, body: unknown) {
  const { _id: userId } = req.user
  const { privateKey, publicKeyHash } = await getSharedKeyPair()
  const headers = signRequest({
    url: remoteUrl,
    method,
    keyId: makeActorKeyUrl(instanceActorName, publicKeyHash),
    privateKey,
    body,
    headers: {
      [remoteUserHeader]: userId,
    },
  })
  return requests_[method](remoteUrl, { headers, body })
}

function forwardRemoteError (err: ContextualizedError, remoteUrl: AbsoluteUrl) {
  if (!('body' in err)) throw err
  const { statusCode } = err
  // @ts-expect-error
  const { status_verbose: message, context } = err.body
  const repackedError = newError(message, statusCode, context)
  repackedError.forwardedFrom = remoteUrl
  return repackedError
}

const closedAccessLevels = [ 'admin', 'dataadmin' ] as const

// Use-cases for duplicating remote endpoints locally:
// - proxy read controllers to keep a local cache and trigger hooks
// - proxy write controllers to handle authenfication
// Note that requests requiring Wikidata OAuth could possibly be replaced by request
// authentified with a server Wikidata account
export function buildProxiedControllers (pathname: RelativeUrl, localControllersParams: MethodsAndActionsControllers) {
  const proxiedControllersParams = {}

  for (const [ method, methodParams ] of objectEntries(localControllersParams)) {
    proxiedControllersParams[method] = {}
    for (const [ accessLevel, actionControllers ] of objectEntries(methodParams)) {
      // Register closed endpoints as public to directly send the "Closed endpoint" error
      // rather than falsly hinting that it's an authentification problem
      const localAccessLevel = arrayIncludes(closedAccessLevels, accessLevel) ? 'public' : accessLevel
      proxiedControllersParams[method][localAccessLevel] ??= {}
      for (const [ actionName, actionController ] of objectEntries(actionControllers)) {
        const controller = proxiedController(accessLevel, method, pathname, actionName as string, actionController)
        proxiedControllersParams[method][localAccessLevel][actionName] = controller
      }
    }
  }

  return methodAndActionsControllersFactory(proxiedControllersParams)
}
