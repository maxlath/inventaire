# Indexation

By default, the server keeps documents in Elasticsearch in sync with the documents in CouchDB (by [`server/db/elasticsearch/reindex_on_change.ts`](https://git.inventaire.io/inventaire/tree/main/server/db/elasticsearch/reindex_on_change.ts)). But if for some reason, you Elasticsearch and CouchDB got out-of-sync, you can always force a reindexation using the following scripts


Environment:
```sh
# Used to determine
# - CouchDB host, credentials, and databases names
# - Elasticsearch host, and indexes names
# - LevelDB folder (relevant for document formatters relying on cached values)
# Any of those values can be overwritten by setting the corresponding parameter in config/local.cjs
export NODE_ENV=production
```

## Items
```sh
npm run indexation:load-from-couchdb items
```

## Users
```sh
npm run indexation:load-from-couchdb users
```

## Groups
```sh
npm run indexation:load-from-couchdb groups
```

## Shelves
```sh
npm run indexation:load-from-couchdb shelves
```

## Lists
```sh
npm run indexation:load-from-couchdb lists
```
