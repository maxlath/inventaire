# Install CouchDB

CouchDB is Inventaire primary database. Other databases are used as secondary indexes (Elasticsearch), or data cache (LevelDB). Consequently, only CouchDB needs to be [backed up](../administration/couchdb_backup_and_restore.md).

## in Docker
See [docker-inventaire](https://github.com/inventaire/docker-inventaire).

## on Debian-based systems

### Enabling package repository

Following https://docs.couchdb.org/en/stable/install/unix.html for Debian or Ubuntu

```sh
sudo apt update && sudo apt install -y curl apt-transport-https gnupg
curl https://couchdb.apache.org/repo/keys.asc | gpg --dearmor | sudo tee /usr/share/keyrings/couchdb-archive-keyring.gpg >/dev/null 2>&1
source /etc/os-release
echo "deb [signed-by=/usr/share/keyrings/couchdb-archive-keyring.gpg] https://apache.jfrog.io/artifactory/couchdb-deb/ ${VERSION_CODENAME} main" \
    | sudo tee /etc/apt/sources.list.d/couchdb.list >/dev/null
sudo apt update
```

You will be prompted for some setups:
* cluster or standalone: standalone should be fine
* set an 'admin' user password
* host ip: set to 0.0.0.0 if you want to set up [replication](../administration/couchdb_backup_and_restore.md#automatic-backup) from a remote server

```sh
sudo apt install couchdb
```

SSL/TLS setup based on https://docs.couchdb.org/en/stable/config/http.html?highlight=ssl#https-ssl-tls-options

```sh
mkdir /opt/couchdb/etc/cert
cd /opt/couchdb/etc/cert
openssl genrsa > privkey.pem
openssl req -new -x509 -key privkey.pem -out couchdb.pem -days 1095 -subj "/C=/ST=/L=/O=/OU=/CN=."
chmod 600 privkey.pem couchdb.pem
chown couchdb privkey.pem couchdb.pem
```

### Add custom settings
```
sudo cp custom.ini /opt/couchdb/etc/local.d/custom.ini
```

Increase Query Servers max memory
See https://docs.couchdb.org/en/stable/config/query-servers.html

```sh
sudo mkdir -p /etc/systemd/system/couchdb.service.d/
echo '
[Service]
Environment=COUCHDB_QUERY_SERVER_JAVASCRIPT="/opt/couchdb/bin/couchjs -S 536870912 /opt/couchdb/share/server/main.js"
' | sudo tee /etc/systemd/system/couchdb.service.d/override.conf

sudo systemctl daemon-reload
sudo systemctl restart couchdb
```

Databases will then be created by the nodejs server at first startup
You still got to set up [database replication](https://docs.couchdb.org/en/stable/replication/intro.html) on your backup server
