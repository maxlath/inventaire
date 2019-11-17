// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const CONFIG = require('config')
const __ = CONFIG.universalPath
const _ = __.require('builders', 'utils')
const execa = require('execa')
const { backupFolder } = require('./get_backup_folder_data')()
const { username, password, host, port } = CONFIG.db

module.exports = dbName => {
  const args = buildArgsArray(backupFolder, dbName)

  return execa('couchdb-backup', args)
  .then(res => {
    _.log(res.stdout, `${dbName} stdout`)
    return _.warn(res.stderr, `${dbName} stderr`)
  })
}

// Depends on 'couchdb-backup' (from https://github.com/danielebailo/couchdb-dump)
// being accessible from the $PATH
const buildArgsArray = (backupFolder, dbName) => {
  const outputFile = `${backupFolder}/${dbName}.json`

  return [
    // Common parameters
    '-b', // backup mode
    '-H', host,
    '-P', port,
    '-u', username,
    '-p', password,
    // Database-specific
    '-d', dbName,
    '-f', outputFile
  ]
}
