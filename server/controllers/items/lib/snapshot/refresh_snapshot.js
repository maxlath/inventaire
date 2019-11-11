// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const __ = require('config').universalPath
const _ = __.require('builders', 'utils')
const assert_ = __.require('utils', 'assert_types')
const entities_ = __.require('controllers', 'entities/lib/entities')
const getEntityByUri = __.require('controllers', 'entities/lib/get_entity_by_uri')
const getEntitiesByUris = __.require('controllers', 'entities/lib/get_entities_by_uris')
const buildSnapshot = require('./build_snapshot')
const { getWorkAuthorsAndSeries, getEditionGraphEntities } = require('./get_entities')
const { getDocData } = require('./helpers')

// Working around circular dependencies
let snapshot_ = null
const lateRequire = () => snapshot_ = require('./snapshot')
setTimeout(lateRequire, 0)

const fromDoc = function(changedEntityDoc){
  const [ uri, type ] = Array.from(getDocData(changedEntityDoc))
  if (!refreshTypes.includes(type)) return 

  const label = `${uri} items snapshot refresh`

  _.info(`${label}: starting`)
  return getSnapshotsByType[type](uri)
  .then(snapshot_.batch)
}

const fromUri = changedEntityUri => getEntityByUri({ uri: changedEntityUri })
.then(fromDoc)

module.exports = { fromDoc, fromUri }

const multiWorkRefresh = relationProperty => uri => entities_.urisByClaim(relationProperty, uri)
.map(getSnapshotsByType.work)
.then(_.flatten)

var getSnapshotsByType = {
  edition(uri){
    // Get all the entities docs required to build the snapshot
    return getEditionGraphEntities(uri)
    // Build common updated snapshot
    .spread(getEditionSnapshot)
  },

  work(uri){
    return getEntityByUri({ uri })
    .then(work => getWorkAuthorsAndSeries(work)
    .spread((authors, series) => Promise.all([
      getWorkSnapshot(uri, work, authors, series),
      getEditionsSnapshots(uri, [ work ], authors, series)
    ])
    .then(_.flatten)))
  },

  human: multiWorkRefresh('wdt:P50'),
  serie: multiWorkRefresh('wdt:P179')
}

var refreshTypes = Object.keys(getSnapshotsByType)

var getWorkSnapshot = function(uri, work, authors, series){
  assert_.types([ 'string', 'object', 'array', 'array' ], arguments)
  return buildSnapshot.work(work, authors, series)
}

var getEditionsSnapshots = function(uri, works, authors, series){
  assert_.types([ 'string', 'array', 'array', 'array' ], arguments)

  return entities_.urisByClaim('wdt:P629', uri)
  .then(uris => getEntitiesByUris({ uris }))
  .then(res => _.values(res.entities))
  .map(edition => getEditionSnapshot(edition, works, authors, series))
}

var getEditionSnapshot = function(edition, works, authors, series){
  assert_.types([ 'object', 'array', 'array', 'array' ], arguments)
  // Expects a formatted edition
  assert_.string(edition.uri)
  return buildSnapshot.edition(edition, works, authors, series)
}
