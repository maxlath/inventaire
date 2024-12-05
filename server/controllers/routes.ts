import activitypub from '#controllers/activitypub/activitypub'
import webfinger from '#controllers/activitypub/webfinger'
import auth from '#controllers/auth/auth'
import fakeSubmit from '#controllers/auth/fake_submit'
import oauthClients from '#controllers/auth/oauth_clients'
import oauthServer from '#controllers/auth/oauth_server'
import authToken from '#controllers/auth/token'
import configEndpoint from '#controllers/config'
import data from '#controllers/data/data'
import { AddRoute } from '#controllers/endpoint'
import { localEntitiesControllers } from '#controllers/entities/entities'
import { federatedEntitiesControllers } from '#controllers/entities/federated_entities'
import extensionsRedirections from '#controllers/extensions_redirections'
import feedback from '#controllers/feedback'
import feeds from '#controllers/feeds/feeds'
import glob from '#controllers/glob'
import groups from '#controllers/groups/groups'
import i18n from '#controllers/i18n'
import images from '#controllers/images/images'
import localFsMediaStorage from '#controllers/images/local_fs_media_storage'
import resizeImages from '#controllers/images/resize'
import invitations from '#controllers/invitations/invitations'
import items from '#controllers/items/items'
import listings from '#controllers/listings/listings'
import notifications from '#controllers/notifications/notifications'
import relations from '#controllers/relations/relations'
import reports from '#controllers/reports/reports'
import search from '#controllers/search/search'
import shelves from '#controllers/shelves/shelves'
import tasks from '#controllers/tasks/tasks'
import tests from '#controllers/tests'
import transactions from '#controllers/transactions/transactions'
import user from '#controllers/user/user'
import users from '#controllers/users/users'
import config, { federatedMode } from '#server/config'

// Routes structure:
// 1 - api is the default prefix for server-side routes
// 2 - the controller / module name

export const routes = {}

const addRoute = AddRoute(routes)

addRoute('api/auth', auth)
addRoute('api/config', configEndpoint)
addRoute('api/data', data)
addRoute('api/feedback', feedback)
addRoute('api/feeds', feeds)
addRoute('api/groups', groups)
addRoute('api/images', images)
addRoute('api/invitations', invitations)
addRoute('api/items', items)
addRoute('api/lists', listings)
addRoute('api/notifications', notifications)
addRoute('api/oauth/authorize', oauthServer.authorize)
addRoute('api/oauth/clients', oauthClients)
addRoute('api/oauth/token', oauthServer.token)
addRoute('api/relations', relations)
addRoute('api/reports', reports)
addRoute('api/search', search)
addRoute('api/shelves', shelves)
addRoute('api/submit', fakeSubmit)
addRoute('api/tests*', tests)
addRoute('api/token', authToken)
addRoute('api/transactions', transactions)
addRoute('api/user', user)
addRoute('api/users', users)
addRoute('api/activitypub', activitypub)
addRoute('img/*', resizeImages)
addRoute('.well-known/webfinger', webfinger)

if (federatedMode) {
  addRoute('api/entities', federatedEntitiesControllers)
} else {
  addRoute('api/entities', localEntitiesControllers)
  addRoute('api/tasks', tasks)
}

if (config.i18n.autofix) {
  addRoute('api/i18n', i18n)
}

if (config.mediaStorage.mode === 'local') {
  // serve images stored on the local file system
  addRoute('local/*', localFsMediaStorage)
}

// setting config-based routes before the globs
// so that they wont be overpassed by it
Object.assign(routes, {
  api: {
    get: glob.redirectToApiDoc,
  },
  'api/*': {
    all: glob.api,
  },
  '*.json': {
    get: extensionsRedirections.json,
  },
  '*.rss': {
    get: extensionsRedirections.rss,
  },
  '*': {
    get: glob.get,
  },
})
