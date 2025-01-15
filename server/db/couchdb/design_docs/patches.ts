import { emit } from '#db/couchdb/couchdb_views_context'
import type { Views } from '#types/couchdb'
import type { Patch } from '#types/patch'

function emitEntityClaim (property, claim, timestamp) {
  const value = typeof claim === 'object' ? claim.value : claim
  if (typeof value === 'string' && (value.startsWith('wd:') || value.startsWith('inv:'))) {
    emit([ value, timestamp ], property)
  }
}

export const views: Views<Patch> = {
  byEntityId: {
    map: doc => {
      const [ entityId, patchNumber ] = doc._id.split(':')
      emit([ entityId, parseInt(patchNumber) ], null)
    },
  },
  byUserAcctAndDate: {
    map: doc => emit([ doc.user, doc.timestamp ], null),
    reduce: '_count',
  },
  byDate: {
    map: doc => emit(doc.timestamp, null),
  },
  byDay: {
    map: doc => {
      const day = new Date(doc.timestamp).toISOString().split('T')[0]
      emit([ day, doc.user ], null)
    },
    reduce: '_count',
  },
  byRedirectUri: {
    map: doc => {
      if ('context' in doc && 'redirectClaims' in doc.context) {
        emit(doc.context.redirectClaims.fromUri, null)
      }
    },
  },
  byClaimValueAndDate: {
    map: [
      emitEntityClaim,
      function (doc) {
        const { timestamp } = doc
        for (const operation of doc.operations) {
          if (operation.op === 'add') {
            const [ , section, property, arrayIndex ] = operation.path.split('/')
            if (section === 'claims') {
              if (arrayIndex != null) {
                emitEntityClaim(property, operation.value, timestamp)
              } else if (property != null) {
                for (const subvalue of operation.value) {
                  emitEntityClaim(property, subvalue, timestamp)
                }
              }
            }
          }
        }
      },
    ],
    reduce: '_count',
  },
  byUserAcctAndFilterAndDate: {
    map: doc => {
      const { user, timestamp } = doc
      // Use an object to deduplicate filters
      const filters = {}
      for (const operation of doc.operations) {
        // ops included: 'add', 'remove'
        if (operation.op !== 'test') {
          // `filter` can be both a label lang or a claim property
          const filter = operation.path.split('/')[2]
          if (filter != null) {
            filters[filter] = true
          }
          // TODO: handle case where path=/claims or path=/labels
          // Known case: after a reverse merge
        }
      }
      for (const filter of Object.keys(filters)) {
        emit([ user, filter, timestamp ])
      }
    },
    reduce: '_count',
  },
}
