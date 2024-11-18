#!/usr/bin/env bash

export NODE_ENV=federated

./scripts/watch.sh 2>&1 |
  # Print logs in both the terminal and this log file
  # to be able to do operations on the logs (grep, less, etc)
  tee ./logs/federated-server.log
