#!/usr/bin/env bash

set -eu

./scripts/check_node_version.ts
./scripts/entities_extended_types_aliases/check_extended_aliases_freshness.ts

# Make git hooks trackable (see https://stackoverflow.com/a/4457124/3324977)
rm -rf .git/hooks
# Symbolic link is relative to the .git directory, thus the path starting with ".."
ln -s ../scripts/githooks .git/hooks

npm run update-i18n

# Make the server types available to the client
# Needs to be re-executed after changing server types
npm run build

mkdir -p logs run db/leveldb keys

touch ./logs/server.log ./logs/error.log
# Expected by scripts/actions/backup_databases.ts
mkdir -p ./db/couchdb/backups
# Create folders for when mediaStorage is in local mode (which is the default)
mkdir -p ./storage/users ./storage/groups ./storage/entities

# If the client folder already exist, assume that it's a re-install
# and that all the following isn't needed
[ -e client ] && exit 0

npm run install-client

npm run generate-local-config-from-env

# See https://git-scm.com/docs/git-config#Documentation/git-config.txt-blameignoreRevsFile
git config blame.ignoreRevsFile .git-blame-ignore-revs
