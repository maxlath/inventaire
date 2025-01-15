#!/usr/bin/env bash

# Default config: config/tests-api-server.cjs
# Locally override: config/local-tests-api-server.cjs
export NODE_ENV=tests-api NODE_APP_INSTANCE=server

echo -e "\e[0;34mStarting tests server in the background: see logs in ./logs/tests-server.log\e[0;30m"
./scripts/watch.sh > logs/tests-server.log 2>&1 &
