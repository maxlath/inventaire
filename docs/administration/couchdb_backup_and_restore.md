# CouchDB backup and restore

## Automatic backup
[CouchDB has fantastic replication capabilities](https://docs.couchdb.org/en/stable/replication/intro.html), which makes it rather easy to keep a copy in sync.

## Manual backup
Additionally, it can be useful to make an archive from time-to-time, in case you might want to restore a previous database state.

### Backup CouchDB databases

Assuming that CouchDB is running on `localhost:5984`, and that we want to backup `prod`-suffixed databases

```sh
npm run couchdb:backup-databases http://yourcouchdbusername:yourcouchdbpassword@localhost:5984 prod
```

With default configuration, backups are stored at root application folder : `./backups/couchdb`

You can customize this target folder in `config/local.cjs`:

```js
module.exports = {
  ...
  db: {
    backupFolder: 'backups/couchdb'
  }
  ...
}
```


### Restore CouchDB databases

Dependencies:
* `jq` (see https://stedolan.github.io/jq/)
* `couchdb-bulk2` (install with `npm install -g couchdb-bulk2`)
* `fzf`

Assuming that CouchDB is running on `localhost:5984`, that we want to restore `prod`-suffixed databases, and there is at least one backup subdirectory in the the backup directory set in config (by default `backups/couchdb`)

```sh
npm run couchdb:restore-databases http://yourcouchdbusername:yourcouchdbpassword@localhost:5984 prod
```
