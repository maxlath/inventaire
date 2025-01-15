import type { DbInfo } from '#db/couchdb/base'
import { setDocsDeletedTrue } from '#lib/couch'
import { assertObjects, assertObject } from '#lib/utils/assert_types'
import { forceArray } from '#lib/utils/base'
import { warn } from '#lib/utils/logs'
import type { CouchDoc } from '#types/couchdb'
import type getDbApi from './cot_base.js'
import type { MaybeIdentifiedDocument } from 'blue-cot/types/nano.js'

export function couchdbBundlesFactory (db: ReturnType<typeof getDbApi> & DbInfo) {
  async function actionAndReturn <D> (method: string, doc: D) {
    assertObject(doc)
    const couchRes = await db[method](doc)
    // @ts-expect-error
    if (!doc._id) doc._id = couchRes.id
    // @ts-expect-error
    doc._rev = couchRes.rev
    return doc as CouchDoc & D
  }

  async function bulkDelete (docs: CouchDoc[]) {
    assertObjects(docs)
    if (docs.length === 0) return []
    warn(docs, `${db.dbName} bulkDelete`)
    return db.bulk(setDocsDeletedTrue(docs))
  }

  return {
    byIds: async <D extends CouchDoc>(ids: string[]) => {
      ids = forceArray(ids)
      const { docs } = await db.fetch<D>(ids)
      return docs
    },
    postAndReturn: <D extends MaybeIdentifiedDocument> (doc: D) => actionAndReturn('post', doc),
    putAndReturn: <D extends CouchDoc> (doc: D) => actionAndReturn('put', doc),
    bulkDelete,
  }
}
