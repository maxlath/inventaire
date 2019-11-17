// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let groupsMap
const CONFIG = require('config')
const wdLang = require('wikidata-lang')
const groupsData = require('isbn-groups')

module.exports = (groupsMap = {})

for (const gs1Prefix in groupsData) {
  const gs1PrefixData = groupsData[gs1Prefix]
  for (const groupId in gs1PrefixData) {
    const groupData = gs1PrefixData[groupId]
    const { lang } = groupData
    if (lang != null) {
      const wdId = `wd:${wdLang.byCode[lang].wd}`
      groupsMap[`${gs1Prefix}-${groupId}`] = {
        lang,
        wd: wdId
      }
    }
  }
}
