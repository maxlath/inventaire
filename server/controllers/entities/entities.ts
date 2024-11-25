import removeLabel from '#controllers/entities/remove_label'
import { verbAndActionsControllersFactory } from '#lib/actions_controllers'
import type { VerbsAndActionsControllers } from '#server/types/controllers'
import byUrisGet from './by_uris_get.js'
import contributions from './contributions.js'
import contributionsCount from './contributions_count.js'
import create from './create.js'
import delet from './delete.js'
import duplicates from './duplicates.js'
import { authorWorks, serieParts, publisherPublications } from './get_entity_relatives.js'
import history from './history.js'
import images from './images.js'
import merge from './merge.js'
import moveToWikidata from './move_to_wikidata.js'
import popularity from './popularity.js'
import resolve from './resolve.js'
import restoreVersion from './restore_version.js'
import reverseClaims from './reverse_claims.js'
import revertEdit from './revert_edit.js'
import revertMerge from './revert_merge.js'
import updateClaim from './update_claim.js'
import updateLabel from './update_label.js'

export const localEntitiesControllersParams = {
  get: {
    public: {
      'by-uris': byUrisGet,
      'reverse-claims': reverseClaims,
      'author-works': authorWorks,
      'serie-parts': serieParts,
      'publisher-publications': publisherPublications,
      images,
      popularity,
      history,
      contributions,
    },
    dataadmin: {
      duplicates,
    },
    admin: {
      'contributions-count': contributionsCount,
    },
  },

  post: {
    public: {
      'by-uris': byUrisGet,
    },
    authentified: {
      create,
      resolve,
      delete: delet,
    },
  },

  put: {
    authentified: {
      'update-claim': updateClaim,
      'update-label': updateLabel,
      'remove-label': removeLabel,
      'revert-edit': revertEdit,
      'restore-version': restoreVersion,
      'move-to-wikidata': moveToWikidata,
      merge,
    },
    dataadmin: {
      'revert-merge': revertMerge,
    },
  },
} as VerbsAndActionsControllers

export const localEntitiesControllers = verbAndActionsControllersFactory(localEntitiesControllersParams)
