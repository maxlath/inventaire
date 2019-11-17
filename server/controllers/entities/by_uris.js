// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const __ = require('config').universalPath
const sanitize = __.require('lib', 'sanitize/sanitize')
const responses_ = __.require('lib', 'responses')
const error_ = __.require('lib', 'error/error')
const getEntitiesByUris = require('./lib/get_entities_by_uris')
const addRelatives = require('./lib/add_relatives')

const validRelativesProperties = [
  'wdt:P50',
  'wdt:P179',
  'wdt:P629'
]

const sanitization = {
  uris: {},
  refresh: { optional: true },
  relatives: {
    whitelist: validRelativesProperties,
    optional: true
  }
}

module.exports = (req, res, next) => sanitize(req, res, sanitization)
.then(params => {
  const { uris, refresh, relatives } = params
  return getEntitiesByUris({ uris, refresh })
  .then(addRelatives(relatives, refresh))
}).then(responses_.Send(res))
.catch(error_.Handler(req, res))
