import CONFIG from 'config'
import { newError } from '#lib/error/error'
import { wait } from '#lib/promises'
import { requests_, type ReqOptions } from '#lib/requests'
import { assert_ } from '#lib/utils/assert_types'
import { log, success } from '#lib/utils/logs'
import { stringifyQuery } from '#lib/utils/url'
import type { AbsoluteUrl, HttpHeaders, HttpMethod, Url } from '#types/common'
import type { User } from '#types/user'
import type { OverrideProperties } from 'type-fest'

const host: AbsoluteUrl = CONFIG.getPublicOrigin()

type RequestOptions = OverrideProperties<ReqOptions, { headers?: HttpHeaders }>

async function testServerAvailability () {
  if (!CONFIG.waitForServer) return

  try {
    await requests_.get(`${host}/api/tests`, { timeout: 1000 })
    success('tests server is ready')
  } catch (err) {
    if (err.code !== 'ECONNREFUSED' && err.name !== 'TimeoutError') throw err
    log('waiting for tests server', null, 'grey')
    await wait(500)
    return testServerAvailability()
  }
}

export const waitForTestServer = testServerAvailability()

export async function rawRequest (method: HttpMethod, url: Url, reqParams: RequestOptions = {}) {
  assert_.string(method)
  assert_.string(url)
  await waitForTestServer
  reqParams.returnBodyOnly = false
  reqParams.redirect = 'manual'
  reqParams.parseJson = reqParams.parseJson || false
  if (url[0] === '/') url = `${host}${url}`
  return requests_[method](url, reqParams)
}

export async function request (method: HttpMethod, endpoint: Url, body?: unknown, cookie?: string) {
  assert_.string(method)
  assert_.string(endpoint)
  const url = (endpoint.startsWith(host) ? endpoint : host + endpoint) as Url
  const options: ReqOptions = {
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

export async function customAuthReq (user, method, endpoint, body) {
  assert_.type('object|promise', user)
  assert_.string(method)
  assert_.string(endpoint)
  user = await user
  // Gets a user doc to which tests/api/fixtures/users added a cookie attribute
  return request(method, endpoint, body, user.cookie)
}

interface TestUser extends User {
  cookie?: string
}

interface RawCustomAuthReqOptions {
  user: TestUser
  method: HttpMethod
  url: Url
  options: RequestOptions
}

export async function rawCustomAuthReq ({ user, method, url, options = {} }: RawCustomAuthReqOptions) {
  assert_.type('object|promise', user)
  assert_.string(method)
  assert_.string(url)
  user = await user
  options.headers = options.headers || {}
  options.headers.cookie = user.cookie
  return rawRequest(method, url, options)
}

export function postUrlencoded (url, body) {
  return rawRequest('post', url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: stringifyQuery(body),
    parseJson: true,
  })
}

export function bearerTokenReq (token, method, endpoint, body) {
  assert_.object(token)
  assert_.string(token.access_token)
  return rawRequest(method, endpoint, {
    headers: {
      authorization: `Bearer ${token.access_token}`,
    },
    parseJson: true,
    body,
  })
}
