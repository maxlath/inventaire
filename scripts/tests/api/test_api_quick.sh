#!/usr/bin/env bash

# Same as ./test_api but without deleting the databases and restarting the server
# each times: can be used to quickly run tests that don't need a complete
# environement reboot. Typically, such a dependency is due to an operation that
# isn't offered by the API at the moment (as those tests don't use as little
# server libs/controllers as possible).
# Known case: deleting an entity isn't possible from the API

# Env variables required to get the right port
export NODE_ENV=tests-api NODE_APP_INSTANCE=server
# Use `toString` to prevent getting colored output
server_port=$(node -p "require('config').port.toString()")
watcher_pid=$(pgrep --full "watcher_server_port_${server_port}")

if [ -n "$watcher_pid" ];
then
  echo -e "\e[0;32mtests server watcher is running: see logs in ./logs/tests-server.log\e[0;30m"
else
  ./scripts/tests/api/start_tests_server.sh
fi

if [ "$INV_FEDERATED_TESTS" = "true" ]; then
  echo -e "\e[0;33mRunning tests server in federated mode\e[0;30m"
  export NODE_ENV=tests-api NODE_APP_INSTANCE=federated-server
  federated_server_port=$(node -p "require('config').port.toString()")
  federated_watcher_pid=$(pgrep --full "watcher_server_port_${federated_server_port}")
  if [ -n "$federated_watcher_pid" ];
  then
    echo -e "\e[0;32mtests server watcher is running: see logs in ./logs/tests-federated-server.log\e[0;30m"
  else
    ./scripts/tests/api/start_tests_federated_server.sh
  fi
fi

./scripts/tests/api/run_api_tests.sh $@
