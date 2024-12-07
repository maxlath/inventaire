import { emit } from '#db/couchdb/couchdb_views_context'
import type { Views } from '#types/couchdb'
import type { DocInUserDb } from '#types/user'

export const views: Views<DocInUserDb> = {
  byEmail: {
    map: doc => {
      if (doc.type === 'user') {
        emit(doc.email.toLowerCase(), null)
      }
    },
  },
  byUsername: {
    map: doc => {
      if ('username' in doc) {
        const username = doc.username.toLowerCase()
        emit(username, null)
        if ('stableUsername' in doc) {
          const stableUsername = doc.stableUsername.toLowerCase()
          if (stableUsername !== username) emit(stableUsername, null)
        }
      }
    },
  },
  byCreation: {
    map: doc => {
      if (doc.type === 'user') {
        emit(doc.created, null)
      }
    },
  },
  byCreationWithReports: {
    map: doc => {
      if (doc.type === 'user' && doc.reports != null && doc.reports.length > 0) {
        emit(doc.created, null)
      }
    },
  },
  byPicture: {
    map: doc => {
      if (doc.type === 'user') {
        if (doc.picture != null) {
          emit(doc.picture.split('/')[3], null)
        }
      }
    },
  },
  nextSummary: {
    map: doc => {
      if (doc.type !== 'user') return
      if (doc.settings && doc.settings.notifications && doc.settings.notifications.global === false) return
      if (doc.settings && doc.settings.notifications && doc.settings.notifications.inventories_activity_summary === false) return
      if (doc.undeliveredEmail > 1) return

      const lastSummary = doc.lastSummary || doc.created
      const summaryPeriodicity = doc.summaryPeriodicity || 20
      const nextSummary = lastSummary + summaryPeriodicity * 24 * 3600 * 1000
      emit(nextSummary, null)
    },
  },
  byAnonymizableId: {
    map: doc => {
      if (doc.type === 'user') {
        if ('anonymizableId' in doc) emit(doc.anonymizableId, null)
      }
    },
  },
}
