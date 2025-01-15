#!/usr/bin/env bash

# Env variables required to get the right port
export NODE_ENV=tests-api NODE_APP_INSTANCE=server
# Use `toString` to prevent getting colored output
server_port=$(node -p "require('config').port.toString()")

# See scripts/watch
pkill --signal INT --full "watcher_server_port_${server_port}"

# Also kill federated tests server if it exists
export NODE_ENV=tests-api NODE_APP_INSTANCE=federated-server
federated_server_port=$(node -p "require('config').port.toString()")
pkill --signal INT --full "watcher_server_port_${federated_server_port}"
