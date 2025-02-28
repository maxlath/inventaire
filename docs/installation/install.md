# Install

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Install on Debian-based systems](#install-on-debian-based-systems)
  - [Dependencies](#dependencies)
  - [Node](#node)
  - [CouchDB](#couchdb)
  - [Elasticsearch](#elasticsearch)
  - [Inventaire](#inventaire)
  - [Reverse proxy](#reverse-proxy)
  - [Usage](#usage)
- [Install on other operating systems](#install-on-other-operating-systems)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Install on Debian-based systems

Typically Debian or Ubuntu

### Dependencies

```sh
apt-get install curl git nginx graphicsmagick openssl inotify-tools software-properties-common -y
```

and optionally:

```sh
apt-get install fail2ban build-essential zsh
```

### Node

Follow the [official NVM install](https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script) documentation.

Once installed, you may install a version of node defined in `package.json`

```json
"engines": {
  "node": ">= 18"
},
```

ie. `nvm install 20`

Once node is installed (check with command `node -v`), install global dependencies:

```sh
npm install -g --production lev2 couchdb-bulk2
```

### CouchDB

See https://git.inventaire.io/inventaire/docs/installation/install_couchdb.md

### Elasticsearch

See https://git.inventaire.io/inventaire/docs/installation/install_elasticsearch.md

### Inventaire

```sh
git clone http://github.com/inventaire/inventaire
cd inventaire
# In production, you can pass the option --omit=dev
npm install
```

You also may setup the root folder variable:

```sh
PROJECT_ROOT=$PWD
```

### Reverse proxy

See https://git.inventaire.io/inventaire/docs/installation/install_reverse_proxy.md

### Usage

Run the app in development:

```sh
npm run watch
```

Run the app in production:
```sh
npm run start-built-server
# Or skipping the npm parent process
./scripts/typescript/start_built_server.sh
```

If you feel like setup systemd configuration, you may check : https://git.inventaire.io/inventaire-deploy/install_inventaire

## Install on other operating systems

The above installation documentation is primarily centered around Debian-based systems, but people have tried to install Inventaire on other systems. We won't host the documentation for those alternative setups in this repository, as it tends to get outdated in absence of maintainers; but you are welcome to link to it:

* [Install on FreeBSD 10-RELEASE amd64](https://github.com/inventaire/inventaire/issues/59)
* [Inventaire NixOS flake](https://github.com/ngi-nix/inventaire)
