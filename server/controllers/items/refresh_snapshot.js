const __ = require('config').universalPath
const _ = __.require('builders', 'utils')
const { Wait } = __.require('lib', 'promises')
const error_ = __.require('lib', 'error/error')
const responses_ = __.require('lib', 'responses')
const refreshSnapshot = require('./lib/snapshot/refresh_snapshot')

module.exports = (req, res) => {
  const { uris } = req.body

  if (!_.isArray(uris)) {
    return error_.bundleInvalid(req, res, 'uris', uris)
  }

  return refreshSequentially(uris)
  .then(responses_.Ok(res))
  .catch(error_.Handler(req, res))
}

const refreshSequentially = uris => {
  const refreshNext = () => {
    const nextUri = uris.pop()

    if (nextUri == null) return Promise.resolve()

    if (!_.isEntityUri(nextUri)) {
      _.warn(nextUri, 'invalid entity URI: not refreshing')
      return refreshNext()
    }

    _.log(nextUri, 'next URI for items snapshot refresh')

    return refreshSnapshot.fromUri(nextUri)
    // Space refreshes to lower stress on production resources
    .then(Wait(100))
    .then(refreshNext)
  }

  return refreshNext()
}
