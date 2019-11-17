// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const CONFIG = require('config')
const __ = CONFIG.universalPath
const _ = __.require('builders', 'utils')
const getDbApi = require('./cot_base')

// if no designDocName is provided,
// assumes it is the same as the dbBaseName
module.exports = (dbBaseName, designDocName) => {
  const dbName = CONFIG.db.name(dbBaseName)
  if (!designDocName) { designDocName = dbBaseName }

  const db = getDbApi(dbName, designDocName)
  const bundles = require('./bundles')(db, _)

  return _.extend(db, bundles)
}
