#!/usr/bin/env bash

# Usage:
#   npm run couchdb:backup-databases http://username:password@localhost:5984 prod
#
# See docs/couchdb_backup_and_restore.md

set -eu

couchdb_url=$1
suffix=${2:-""}
today=$(date -I)
backup_folder_base=$(node -p "require('config').db.backupFolder")
backup_folder="$backup_folder_base/$today"
mkdir -p "$backup_folder"
echo "backup folder: $backup_folder"

for name in $(./scripts/couchdb/get_databases_names.js "$suffix") ; do
  echo "backup database: $name"
  export_file="${backup_folder}/${name}.ndjson"
  ./scripts/couchdb/export_database_as_ndjson.sh "$couchdb_url/$name" > "$export_file"
  gzip --best --force "$export_file"
done

du -ah "$backup_folder"
