import { databases } from '#db/couchdb/databases'
import { objectKeys } from '#lib/utils/types'

const singularize = str => str.replace(/s$/, '')
const singularizedDatabasesNames = objectKeys(databases).map(singularize)

// Additionally all 1 letter strings are reserved words
// but the restriction is handled by the username regex
const reservedWords = new Set([
  ...singularizedDatabasesNames,
  'api',
  'auth',
  'client',
  'contact',
  'contribute',
  'donate',
  'ean',
  'email',
  'exchange',
  'feedback',
  'friend',
  'give',
  'group',
  'instance',
  'inv',
  'inventories',
  'inventorize',
  'inventory',
  'invite',
  'invited',
  'isbn',
  'key',
  'last',
  'latest',
  'lend',
  'local',
  'map',
  'me',
  'nearby',
  'network',
  'oauth',
  'private',
  'profil',
  'profile',
  'public',
  'relation',
  'self',
  'sell',
  'server',
  'setting',
  'share',
  'user',
  'username',
  'value',
  'wd',
  'welcome',
  'wikidata',
])

export default username => {
  const maybePlural = username.toLowerCase()
  const singular = singularize(maybePlural)
  return reservedWords.has(singular) || reservedWords.has(maybePlural)
}
