import type { SparqlQueryParams } from '#data/wikidata/queries/queries'
import { typesAliases } from '#lib/wikidata/aliases'

const { works: worksP31Values, editions: editionsP31Values } = typesAliases

export default {
  parameters: [ 'pid', 'qid' ] as const,

  relationProperties: [ '*' ] as const,

  query: (params: SparqlQueryParams) => {
    const { pid, qid } = params
    let existFilter = ''
    // Only include editions that are properly shaped
    // that is, that have at least an associated work and a title
    if (pid !== 'P629') existFilter += '?edition wdt:P629 ?work . '
    if (pid !== 'P1476') existFilter += '?edition wdt:P1476 ?title . '
    // Filter-out entities that getInvEntityType might consider either a work or an edition
    return `SELECT DISTINCT ?edition WHERE {
  ?edition wdt:${pid} wd:${qid} .
  VALUES (?edition_type) { ${editionsP31Values.map(uri => `(${uri})`).join(' ')} }
  ?edition wdt:P31 ?edition_type .
  FILTER NOT EXISTS {
    # (1)
    VALUES (?work_type) { ${worksP31Values.map(uri => `(${uri})`).join(' ')} }
    ?edition wdt:P31 ?work_type
  }
  FILTER EXISTS { ${existFilter} }
}
LIMIT 1000`
  },

  minimizable: true,
}

// (1) Filter-out entities that getStrictEntityType will not identify as edition due to the type ambiguity
