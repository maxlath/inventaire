import { isAuthentifiedReq, isRelativeUrl } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { newUnauthorizedApiAccessError } from '#lib/error/pre_filled'
import { federatedRequest } from '#lib/federation/federated_requests'
import { runPostProxiedRequestHooks } from '#lib/federation/proxied_requests_hooks'
import { signedFederatedRequest } from '#lib/federation/signed_federated_request'
import { httpMethodHasBody, requests_ } from '#lib/requests'
import type { AccessLevel } from '#lib/user_access_levels'
import config from '#server/config'
import type { AbsoluteUrl, RelativeUrl } from '#types/common'
import type { ActionController, ActionControllerFunction, ActionControllerStandaloneFunction, HttpMethod } from '#types/controllers'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, Req, Res } from '#types/server'

const { remoteEntitiesOrigin } = config.federation

export function proxiedController (accessLevel: AccessLevel, method: HttpMethod, pathname: RelativeUrl, action: string, actionController: ActionController) {
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
  const body = httpMethodHasBody(method) ? req.body : undefined
  if (isAuthentifiedReq(req)) {
    const res = await signedFederatedRequest(req, method, url, body)
    runPostProxiedRequestHooks(method, url, action, params)
    return res
  } else if (accessLevel === 'public') {
    const res = await federatedRequest(method, url, { body })
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
