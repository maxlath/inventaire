# Import inventaire.io entities dump

Create or update entities documents by importing entities from [inventaire.io dumps](https://dumps.inventaire.io).

## Dependencies
* nodejs
* `couchdb-bulk2` (install with `npm install -g couchdb-bulk2`)

## Prerequisites

* A CouchDB instance up and running
* An existing couchdb entities database (automatically created when starting inventaire server)

## Import

```sh
wget https://dumps.inventaire.io/inv/latest/entities.ndjson.gz
gzip --decompress entities.ndjson.gz
cat entities.ndjson |
  # Drop _rev ids if restoring on a new database
  sed --regexp-extended 's/,"_rev":"[0-9]+-[0-9a-f]{32}"//'  |
  couchdb-bulk2 "http://${couchdb_username}:${couchdb_password}@localhost:5984/entities"
```

## Troubleshooting

If the post bulk crash, ie. with an error which looks like `{"error":"unknown_error","reason":"badarg"[...]}`. Restart CouchDB container and add options `--batch-length 50` and/or `--sleep 500` to `couchdb-bulk2` command in order to slow down the process allowing CouchDB to breath a bit (see https://github.com/apache/couchdb/issues/1184)
