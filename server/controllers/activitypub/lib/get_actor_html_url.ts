import { getActorTypeFromName, getEntityUriFromActorName } from './helpers.js'

const getActorHtmlUrlByType = {
  user: name => `/users/${name}`,
  shelf: name => {
    const id = name.split('-')[1]
    return `/shelves/${id}`
  },
  item: name => {
    const id = name.split('-')[1]
    return `/items/${id}`
  },
  entity: name => {
    const uri = getEntityUriFromActorName(name)
    return `/entity/${uri}`
  },
}

export default name => {
  const type = getActorTypeFromName(name)
  return getActorHtmlUrlByType[type](name)
}
