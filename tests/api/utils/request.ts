import type { AwaitableUserWithCookie } from '#fixtures/users'
import { newError } from '#lib/error/error'
import { wait } from '#lib/promises'
import { requests_, type RequestOptions } from '#lib/requests'
import { assertObject, assertType, assertString } from '#lib/utils/assert_types'
import { log, success } from '#lib/utils/logs'
import { stringifyQuery } from '#lib/utils/url'
import config from '#server/config'
import type { AbsoluteUrl, HttpHeaders, HttpMethod, Url } from '#types/common'
import type { BearerToken } from '#types/oauth'
import type { OverrideProperties } from 'type-fest'

const origin: AbsoluteUrl = config.getPublicOrigin()

type RawRequestOptions = OverrideProperties<RequestOptions, { headers?: HttpHeaders }>

async function testServerAvailability () {
  if (!config.waitForServer) return

  try {
    await requests_.get(`${origin}/api/tests`, { timeout: 1000 })
    success('tests server is ready')
  } catch (err) {
    if (err.code !== 'ECONNREFUSED' && err.name !== 'TimeoutError') throw err
    log('waiting for tests server', null, 'grey')
    await wait(500)
    return testServerAvailability()
  }
}

export const waitForTestServer = testServerAvailability()

export async function rawRequest (method: HttpMethod, url: Url, reqParams: RawRequestOptions = {}) {
  assertString(method)
  assertString(url)
  await waitForTestServer
  reqParams.returnBodyOnly = false
  reqParams.redirect = 'manual'
  reqParams.parseJson = reqParams.parseJson || false
  if (url[0] === '/') url = `${origin}${url}`
  return requests_[method](url as AbsoluteUrl, reqParams)
}

export async function request (method: HttpMethod, endpoint: Url, body?: unknown, cookie?: string) {
  assertString(method)
  assertString(endpoint)
  const url = (endpoint.startsWith('/') ? origin + endpoint : endpoint) as AbsoluteUrl
  const options: RequestOptions = {
    headers: { cookie },
    redirect: 'error',
    body,
  }

  await waitForTestServer
  try {
    return await requests_[method](url, options)
  } catch (err) {
    if (err.message === 'request error' && err.body && err.body.status_verbose) {
      err.message = `${err.message}: ${err.body.status_verbose}`
    }
    if (err.type === 'no-redirect') {
      err = newError('request was redirected: use rawRequest to test redirections', 500, { method, url, options })
    }
    throw err
  }
}

export async function customAuthReq (user: AwaitableUserWithCookie, method: HttpMethod, endpoint: Url, body?: unknown) {
  assertType('object|promise', user)
  assertString(method)
  assertString(endpoint)
  user = await user
  // Gets a user doc to which tests/api/fixtures/users added a cookie attribute
  return request(method, endpoint, body, user.cookie)
}

interface RawCustomAuthReqOptions {
  user: AwaitableUserWithCookie
  method: HttpMethod
  url: Url
  options?: RequestOptions
}

export async function rawCustomAuthReq ({ user, method, url, options = {} }: RawCustomAuthReqOptions) {
  assertType('object|promise', user)
  assertString(method)
  assertString(url)
  user = await user
  options.headers = options.headers || {}
  options.headers.cookie = user.cookie
  return rawRequest(method, url, options)
}

export function postUrlencoded (url: Url, body: unknown) {
  return rawRequest('post', url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: stringifyQuery(body),
    parseJson: true,
  })
}

export function bearerTokenReq (token: BearerToken, method: HttpMethod, endpoint: Url, body?: unknown) {
  assertObject(token)
  assertString(token.access_token)
  return rawRequest(method, endpoint, {
    headers: {
      authorization: `Bearer ${token.access_token}`,
    },
    parseJson: true,
    body,
  })
}
