#!/usr/bin/env bash

if [ "$INV_FEDERATED_TESTS" = "true" ]; then
  echo -e "\e[0;33mRunning API tests in federated mode\e[0;30m"
  NODE_APP_INSTANCE=federated-mocha
else
  NODE_APP_INSTANCE=mocha
fi

export NODE_ENV=tests-api NODE_APP_INSTANCE=$NODE_APP_INSTANCE

# Use `toString` to prevent getting colored output
timeout=$(node -p 'require("config").mocha.timeout.toString()')

# If no test file is passed as argument, run all tests
if [ -z "$1" ]
then
  mocha --exit $MOCHA_OPTIONS --timeout "$timeout" --recursive ./tests/api
else
  mocha --exit $MOCHA_OPTIONS --timeout "$timeout" --color --recursive "$@"
fi
