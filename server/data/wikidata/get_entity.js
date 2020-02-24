// A request regrouper to query entities full data one by one
// while requests are actually regrouped in the background
const CONFIG = require('config')
const __ = CONFIG.universalPath
const _ = __.require('builders', 'utils')
const requests_ = __.require('lib', 'requests')
const requestGrouper = __.require('lib', 'request_grouper')
const { getEntities, getManyEntities } = require('wikidata-sdk')

const requester = ids => {
  if (ids.length > 50) {
    // Using getManyEntities to work around the 50 entities limit
    // But, normally, caching should allow to limit its use to some
    // exceptionnal requests (like when someone wants refreshed data
    // of the whole Victor Hugo bibliographie)
    const urls = getManyEntities(ids)
    _.log(urls, 'get many wikidata entities')
    return Promise.all(urls.map(getReq))
    .then(mergeResults)
  } else {
    const url = getEntities(ids)
    return getReq(url)
    .get('entities')
  }
}

// Limiting arguments to strictly 1
const getReq = url => requests_.get(url)
const mergeResults = results => Object.assign.apply(_, results.map(_.property('entities')))

// Expose a single requester
// Taking a Wikidata Id
// Returning the corresponding entity object
module.exports = requestGrouper({ requester, delay: 5 })
