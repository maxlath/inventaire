// This module implements a model object as expected by express-oauth-server and oauth2-server
// See specification https://oauth2-server.readthedocs.io/en/latest/model/overview.html

import InvalidClientError from 'oauth2-server/lib/errors/invalid-client-error'
import user_ from '#controllers/user/lib/user'
import error_ from '#lib/error/error'
import assert_ from '#lib/utils/assert_types'
import { passwords } from '#lib/crypto'
import clients_ from './clients.js'
import authorizations_ from './authorizations.js'
import tokens_ from './tokens.js'

const { catchNotFound } = error_

export default {
  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#getaccesstoken-accesstoken-callback
  getAccessToken: async bearerToken => {
    if (!bearerToken) return false
    const token = await tokens_.byId(bearerToken).catch(catchNotFound)
    if (!token) return false
    const client = await clients_.byId(token.clientId)
    const user = await user_.byId(token.userId)
    return Object.assign(token, { client, user })
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#getclient-clientid-clientsecret-callback
  getClient: async (clientId, clientSecret) => {
    let client
    try {
      client = await clients_.byId(clientId)
    } catch (err) {
      if (err.statusCode === 404) throw error_.new('unknown client', 400, { clientId })
      else throw err
    }

    // Secret validation is done only while trying to optain a token, not when generating an authorization
    if (clientSecret === null) return client

    const isValidSecret = await passwords.verify(client.secret, clientSecret)
    if (isValidSecret) {
      return client
    } else {
      // Without a valid client, oauth2-server@3.0.0 throws 'client is invalid', which is quite unspecific
      throw new InvalidClientError('Invalid client: client credentials are invalid')
    }
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#saveauthorizationcode-code-client-user-callback
  saveAuthorizationCode: async (code, client, user) => {
    await authorizations_.save(code, user._id, client.id)
    return Object.assign(code, { client, user })
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#getauthorizationcode-authorizationcode-callback
  getAuthorizationCode: async authorizationCode => {
    const foundAuthorizationCode = await authorizations_.byId(authorizationCode).catch(catchNotFound)
    if (!foundAuthorizationCode) return
    const client = await clients_.byId(foundAuthorizationCode.clientId)
    const user = await user_.byId(foundAuthorizationCode.userId)
    return Object.assign(foundAuthorizationCode, { client, user })
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#savetoken-token-client-user-callback
  saveToken: async (token, client, user) => {
    await tokens_.save(token, user._id, client.id)
    return Object.assign(token, { client, user })
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#revokeauthorizationcode-code-callback
  revokeAuthorizationCode: async code => {
    const { authorizationCode } = code
    const foundAuthorizationCode = await authorizations_.byId(authorizationCode).catch(catchNotFound)
    if (foundAuthorizationCode != null) {
      await authorizations_.delete(foundAuthorizationCode)
      return true
    } else {
      return false
    }
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#validatescope-user-client-scope-callback
  validateScope: async (user, client, scope) => {
    if (typeof scope === 'string') scope = getScopeArray(scope)
    assert_.array(client.scope)
    if (scope.every(scopePart => client.scope.includes(scopePart))) {
      return scope
    } else {
      return false
    }
  },

  // Spec https://oauth2-server.readthedocs.io/en/latest/model/spec.html#verifyscope-accesstoken-scope-callback
  verifyScope: async (token, acceptedScopes) => {
    if (typeof token.scope === 'string') token.scope = getScopeArray(token.scope)
    assert_.array(acceptedScopes)
    token.matchingScopes = token.scope.filter(scope => acceptedScopes.includes(scope))
    return token.matchingScopes.length > 0
  }
}

const scopeSeparators = /[\s+]/
const getScopeArray = scopeStr => scopeStr.split(scopeSeparators)
