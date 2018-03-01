# additionnaly all 1 letter strings are reserved words
# but the restriction is handled by the username regex
reservedWords = [
  'api'
  'entity'
  'entities'
  'inventory'
  'inventories'
  'wd'
  'wikidata'
  'isbn'
  'ean'
  'profil'
  'profile'
  'item'
  'items'
  'auth'
  'listings'
  'contacts'
  'contact'
  'user'
  'users'
  'friend'
  'friends'
  'welcome'
  'username'
  'email'
  'nearby'
  'map'
  'last'
  'group'
  'groups'
  'transaction'
  'transactions'
  'exchange'
  'exchanges'
  'share'
  'give'
  'sell'
  'lend'
  'inventorize'
  'public'
  'private'
  'auth'
  'me'
  'setting'
  'settings'
  'contribute'
  'donate'
  'feedback'
]

module.exports =  (username)-> username in reservedWords
