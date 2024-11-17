import config from '#server/config'
import entities from './entity.js'
import groups from './group.js'
import items from './item.js'
import lists from './list.js'
import shelves from './shelf.js'
import users from './user.js'

const federatedEntities = config.federation.remoteEntitiesOrigin != null

export default {
  groups,
  items,
  shelves,
  lists,
  users,
  ...(federatedEntities
    ? {}
    : {
      wikidata: entities,
      entities,
    }),
}
