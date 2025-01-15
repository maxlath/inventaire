import { sample } from 'lodash-es'
import { sentence } from '#fixtures/text'
import { customAuthReq } from '#tests/api/utils/request'
import { getUser } from '#tests/api/utils/utils'
import {
  createEdition,
  createEditionWithWorkAndAuthor,
  createEditionWithWorkAuthorAndSerie,
} from './entities.js'

const getEditionUri = async (lang = 'en') => {
  const { uri } = await createEdition({ lang })
  return uri
}

const createItemWithEntities = createEntityFn => async (user?, itemData = {}) => {
  const { uri } = await createEntityFn()
  itemData.entity = uri
  return createItem(user, itemData)
}

export const createItems = async (user?, itemsData = []) => {
  user = user || getUser()
  const items = await Promise.all(itemsData.map(addDefaultEntity))
  return customAuthReq(user, 'post', '/api/items', items)
}

export async function createItem (user?, itemData?) {
  user = user || getUser()
  itemData = itemData || {}
  itemData.visibility = itemData.visibility || [ 'public' ]
  await addDefaultEntity(itemData)
  const [ item ] = await customAuthReq(user, 'post', '/api/items', [ itemData ])
  return item
}

export function createRandomizedItems (user, itemsData) {
  return createItems(user, itemsData.map(fillItemWithRandomData))
}

export const createItemWithEditionAndWork = createItemWithEntities(createEdition)
export const createItemWithAuthor = createItemWithEntities(createEditionWithWorkAndAuthor)
export const createItemWithAuthorAndSerie = createItemWithEntities(createEditionWithWorkAuthorAndSerie)

const transactions = [ 'giving', 'lending', 'selling', 'inventorying' ]
const someVisibilityValues = [
  [],
  [ 'friends' ],
  [ 'groups' ],
  [ 'friends', 'groups' ],
  [ 'public' ],
]

const fillItemWithRandomData = (itemData = {}) => {
  itemData.visibility = itemData.visibility || sample(someVisibilityValues)
  itemData.transaction = itemData.transaction || sample(transactions)
  itemData.details = sentence()
  itemData.notes = sentence()
  return itemData
}

const addDefaultEntity = async itemData => {
  if (!itemData.entity) {
    const entity = itemData[0] && itemData[0].entity
    const entityUri = await (entity || getEditionUri())
    itemData.entity = entityUri
  }
  return itemData
}
