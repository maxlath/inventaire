import { newError } from '#lib/error/error'
import type { RemoteUser } from '#lib/federation/remote_user'
import config from '#server/config'
import type { SpecialUser, User } from '#types/user'

const { wikidataOAuth, botAccountWikidataOAuth } = config

export function hasWikidataOAuth (user: User | SpecialUser | RemoteUser) {
  if ('type' in user && user.type === 'special') return true
  return 'oauth' in user && 'wikidata' in user.oauth && user.oauth.wikidata != null
}

export function validateWikidataOAuth (user: User | SpecialUser | RemoteUser) {
  if (!hasWikidataOAuth(user)) {
    throw newError('missing wikidata oauth tokens', 400)
  }
}

export function getWikidataOAuthCredentials (user: User | SpecialUser | RemoteUser) {
  if ('type' in user && user.type === 'special') {
    return {
      oauth: botAccountWikidataOAuth,
    }
  } else {
    if (('oauth' in user && 'wikidata' in user.oauth)) {
      return {
        oauth: { ...wikidataOAuth, ...user.oauth.wikidata },
      }
    } else {
      throw newError('missing wikidata oauth tokens', 400)
    }
  }
}
