/* eslint-disable
    implicit-arrow-linebreak,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const CONFIG = require('config')
const __ = CONFIG.universalPath
const fetchExternalAuthorWorksTitles = __.require('data', 'lib/fetch_external_author_works_titles')

const endpoint = 'http://data.bnf.fr/sparql'

const getQuery = bnfId => // TODO: restrict expressions of work result to Text only
// probably with dcterms:type dcmitype:Text
  `\
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?title ?work WHERE {
<http://data.bnf.fr/ark:/12148/cb${bnfId}> foaf:focus ?person .
{ ?work dcterms:creator ?person ;
    rdfs:label ?title . }
UNION
{ ?work dcterms:contributor ?person ;
    rdfs:label ?title . }
}\
`

module.exports = fetchExternalAuthorWorksTitles('bnf', endpoint, getQuery)
