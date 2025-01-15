import { actionsControllersFactory } from '#lib/actions_controllers'
import byIds from './by_ids.js'
import byOwners from './by_owners.js'
import create from './create.js'
import deleteByIds from './delete_by_ids.js'
import { addItems, removeItems } from './items_actions.js'
import update from './update.js'

export default {
  get: actionsControllersFactory({
    public: {
      'by-ids': byIds,
      'by-owners': byOwners,
    },
  }),
  post: actionsControllersFactory({
    authentified: {
      create,
      // TODO: harmonize with other endpoints to have 'update'
      // and assimilated actions use the PUT method
      update,
      'add-items': addItems,
      'remove-items': removeItems,
      delete: deleteByIds,
    },
  }),
}
