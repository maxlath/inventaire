#!/usr/bin/env bash

# Default config: config/tests-api-federated-server.cjs
# Locally override: config/local-tests-api-federated-server.cjs
export NODE_ENV=tests-api NODE_APP_INSTANCE=federated-server

echo -e "\e[0;34mStarting tests federated server in the background: see logs in ./logs/tests-federated-server.log\e[0;30m"
./scripts/watch.sh > logs/tests-federated-server.log 2>&1 &
