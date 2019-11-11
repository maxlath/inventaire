// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Keep in sync with client/app/lib/boolean_tests

let tests
const CONFIG = require('config')
const __ = CONFIG.universalPath
const _ = require('lodash')
const regex_ = __.require('lib', 'regex')
const wdk = require('wikidata-sdk')

const bindedTest = regexName => regex_[regexName].test.bind(regex_[regexName])

const isCouchUuid = regex_.CouchUuid.test.bind(regex_.CouchUuid)
const isNonEmptyString = str => _.isString(str) && (str.length > 0)

module.exports = (tests = {
  isUrl: bindedTest('Url'),
  isImageHash: bindedTest('ImageHash'),
  isLocalImg: bindedTest('LocalImg'),
  isAssetImg: bindedTest('AssetImg'),
  isUserImg: bindedTest('UserImg'),
  isLang: bindedTest('Lang'),
  isInvEntityId: isCouchUuid,
  isInvEntityUri(uri){
    if (!isNonEmptyString(uri)) return false
    const [ prefix, id ] = Array.from(uri != null ? uri.split(':') : undefined)
    return (prefix === 'inv') && isCouchUuid(id)
  },
  isWdEntityUri(uri){
    if (!_.isNonEmptyString(uri)) return false
    const [ prefix, id ] = Array.from(uri != null ? uri.split(':') : undefined)
    return (prefix === 'wd') && wdk.isItemId(id)
  },
  isEmail: bindedTest('Email'),
  isUserId: isCouchUuid,
  isGroupId: isCouchUuid,
  isItemId: isCouchUuid,
  isUsername: bindedTest('Username'),
  isEntityUri: bindedTest('EntityUri'),
  isExtendedEntityUri(uri){
    const [ prefix, id ] = Array.from(uri.split(':'))
    // Accept alias URIs.
    // Ex: twitter:Bouletcorp -> wd:Q1524522
    return isNonEmptyString(prefix) && isNonEmptyString(id)
  },
  isPropertyUri: bindedTest('PropertyUri'),
  isSimpleDay(str){
    let isValidDate = false
    try {
      // This line will throw if the date is invalid
      // Ex: '2018-03-32' or '2018-02-30'
      const isoDate = (new Date(str)).toISOString()
      // Keep only the passed precision
      const truncatedIsoDate = isoDate.slice(0, str.length)
      isValidDate = truncatedIsoDate === str
    } catch (err) {
      isValidDate = false
    }

    return isValidDate && regex_.SimpleDay.test(str)
  },
  isNonEmptyString,
  isNonEmptyArray(array){ return _.isArray(array) && (array.length > 0) },
  isNonEmptyPlainObject(obj){ return _.isPlainObject(obj) && (Object.keys(obj).length > 0) },
  isPositiveIntegerString(str){ return _.isString(str) && /^\d+$/.test(str) },
  isExtendedUrl(str){ return tests.isUrl(str) || tests.isLocalImg(str) },
  isCollection(array){ return (_.typeOf(array) === 'array') && _.every(array, _.isPlainObject) }
})
