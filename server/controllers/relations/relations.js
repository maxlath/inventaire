import ActionsControllers from '#lib/actions_controllers'
import relationsActions from './actions.js'

export default {
  get: ActionsControllers({
    authentified: {
      default: require('./get')
    }
  }),

  post: ActionsControllers({
    authentified: {
      request: relationsActions('request'),
      cancel: relationsActions('cancel'),
      accept: relationsActions('accept'),
      discard: relationsActions('discard'),
      unfriend: relationsActions('unfriend')
    }
  })
}
