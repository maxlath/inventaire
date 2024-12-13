import { makeActorKeyUrl } from '#controllers/activitypub/lib/get_actor'
import { signRequest } from '#controllers/activitypub/lib/security'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'
import { getUserAnonymizableId } from '#controllers/user/lib/anonymizable_user'
import { methodAndActionsControllersFactory } from '#lib/actions_controllers'
import { isAuthentifiedReq, isRelativeUrl } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { newUnauthorizedApiAccessError } from '#lib/error/pre_filled'
import { federatedRequest } from '#lib/federation/federated_requests'
import { instanceActorName } from '#lib/federation/instance'
import { runPostProxiedRequestHooks } from '#lib/federation/proxied_requests_hooks'
import { remoteUserHeader } from '#lib/federation/remote_user'
import { httpMethodHasBody, requests_ } from '#lib/requests'
import type { AccessLevel } from '#lib/user_access_levels'
import { arrayIncludes, objectEntries } from '#lib/utils/base'
import config from '#server/config'
import type { AbsoluteUrl, RelativeUrl } from '#types/common'
import type { ActionController, ActionControllerFunction, ActionControllerStandaloneFunction, HttpMethod, MethodsAndActionsControllers } from '#types/controllers'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, Req, Res } from '#types/server'

const { remoteEntitiesOrigin } = config.federation

function proxiedController (accessLevel: AccessLevel, method: HttpMethod, pathname: RelativeUrl, action: string, actionController: ActionController) {
  if (accessLevel === 'admin' || accessLevel === 'dataadmin') return closedEndpointFactory(method, pathname, action)
  let sanitization, track
  if (typeof actionController !== 'function') {
    ;({ sanitization, track } = actionController)
  }

  const controller = proxiedControllerFunctionFactory(accessLevel, method, pathname, action, actionController)

  if (typeof actionController === 'function') {
    return controller
  } else {
    // Sanitize locally before proxying
    return { controller, sanitization, track }
  }
}

function proxiedControllerFunctionFactory (accessLevel: AccessLevel, method: HttpMethod, pathname: RelativeUrl, action: string, actionController: ActionController) {
  if (typeof actionController === 'function') {
    return async function controller (req: Req, res: Res) {
      const remoteUrl = `${remoteEntitiesOrigin}${req.url}` as AbsoluteUrl
      if (accessLevel === 'public') {
        if (shouldBeRedirected(method, pathname, action, req.query)) {
          // Redirecting is a simple way to support the different types or responses that an endpoint such as /api/entities?action=images might return
          // Alternatively, a `fetch` request could be piped to `res`
          // See https://stackoverflow.com/a/77589444
          res.redirect(remoteUrl)
        } else {
          const { url } = req
          const body = httpMethodHasBody(method) ? req.body : undefined
          const remoteRes = await requests_[method](remoteUrl, { body })
          runPostProxiedRequestHooks(method, url as RelativeUrl, action, req.query)
          return res.json(remoteRes)
        }
      } else {
        throw newError('non-public controllers can not be redirected', 500, { url: req.url, accessLevel, method, action })
      }
    } as ActionControllerStandaloneFunction
  } else {
    return async function controller (params: SanitizedParameters, req: Req | AuthentifiedReq) {
      return _proxiedController(req, accessLevel, method, action, params)
    } as ActionControllerFunction
  }
}

function shouldBeRedirected (method: HttpMethod, pathname: RelativeUrl, action: string, query?: { redirect?: boolean }) {
  return method === 'get' && pathname === '/api/entities' && action === 'images' && query.redirect
}

async function _proxiedController (req: Req | AuthentifiedReq, accessLevel: AccessLevel, method: HttpMethod, action: string, params?: SanitizedParameters) {
  const { url } = req
  if (!isRelativeUrl(url)) throw newError('invalid relative url', 500, { method, action, params })
  const remoteUrl = `${remoteEntitiesOrigin}${req.url}` as AbsoluteUrl
  const body = httpMethodHasBody(method) ? req.body : undefined
  if (isAuthentifiedReq(req)) {
    const res = await signedProxyRequest(req, method, remoteUrl, body)
    runPostProxiedRequestHooks(method, url, action, params)
    return res
  } else if (accessLevel === 'public') {
    const res = await federatedRequest(method, remoteUrl, { body })
    runPostProxiedRequestHooks(method, url, action, params)
    return res
  } else {
    throw newUnauthorizedApiAccessError(401)
  }
}

function closedEndpointFactory (method: HttpMethod, pathname: RelativeUrl, action: string) {
  return function closedEndpointController () {
    throw newError('This endpoint is closed in federated mode', 400, { endpoint: `${method.toUpperCase()} ${pathname}?action=${action}` })
  }
}

async function signedProxyRequest (req: AuthentifiedReq, method: HttpMethod, remoteUrl: AbsoluteUrl, body: unknown) {
  const userAnonymizableId = await getUserAnonymizableId(req.user)
  const { privateKey, publicKeyHash } = await getSharedKeyPair()
  const headers = signRequest({
    url: remoteUrl,
    method,
    keyId: makeActorKeyUrl(instanceActorName, publicKeyHash),
    privateKey,
    body,
    headers: {
      [remoteUserHeader]: userAnonymizableId,
    },
  })
  return federatedRequest(method, remoteUrl, { headers, body })
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
