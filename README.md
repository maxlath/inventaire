<div align="center">

# Inventaire

**[Visit inventaire.io](https://inventaire.io) | [Create an instance](https://git.inventaire.io/inventaire/tree/main/docs) | [Wiki](https://wiki.inventaire.io) | [Contact us](https://wiki.inventaire.io/wiki/Communication_channels) | [Donate](https://wiki.inventaire.io/wiki/Funding#Donations)**

[![License](https://img.shields.io/badge/license-AGPL3-blue.svg)](http://www.gnu.org/licenses/agpl-3.0.html)
[![Node](https://img.shields.io/badge/node->=v4-brightgreen.svg)](https://nodejs.org)
[![Code Climate](https://codeclimate.com/github/inventaire/inventaire/badges/gpa.svg)](https://codeclimate.com/github/inventaire/inventaire)<br>

</div>

Inventaire is a libre/open webapp to make inventories and lists of books, powered by open-knowledge.

[![inventory screenshot](https://github.com/inventaire/inventaire/assets/1596934/844c04ff-a216-48dc-b3b9-c33a106b8fbe)](https://inventaire.io)

This repository hosts the server-side code of the [Inventaire association](https://wiki.inventaire.io/wiki/Association), a collaborative resources mapper project, while yet only focused on exploring books mapping with [Wikidata](https://wikidata.org/) and [ISBNs](https://en.wikipedia.org/wiki/International_Standard_Book_Number). The flagship instance is https://inventaire.io and anyone may [create their own federated instance](https://git.inventaire.io/inventaire/tree/main/docs).

This repository tracks server-side developments, while the (heavy) [client-side can be found here](https://github.com/inventaire/inventaire-client). Client-related technical issues should go in the client repo, while this repo gathers all other technical issues. Non-technical discussions, such as feature requests, should preferably happen in the [chat](https://wiki.inventaire.io/wiki/Communication_channels#Chat).

## Summary
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
  - [Dependencies to install manually](#dependencies-to-install-manually)
  - [Project development environment installation](#project-development-environment-installation)
    - [server](#server)
      - [emails](#emails)
    - [client](#client)
  - [Installation tips](#installation-tips)
  - [Repositories and Branches](#repositories-and-branches)
    - [server](#server-1)
    - [client](#client-1)
    - [i18n](#i18n)
    - [deploy](#deploy)
    - [docker](#docker)
- [Stack Map](#stack-map)
- [Concepts map](#concepts-map)
- [Contribute](#contribute)
- [Documentation](#documentation)
- [Wiki](#wiki)
- [API](#api)
- [Administration](#administration)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

*This is the installation documentation for a developement environment. For production setup, see*: [docs](https://git.inventaire.io/inventaire/tree/main/docs)

### Dependencies to install manually
- [git](https://git-scm.com/), [curl](https://curl.haxx.se) (used in some installation scripts), [graphicsmagick](www.graphicsmagick.org/README.html) (used to resize images), [inotify-tools](https://github.com/rvoicilas/inotify-tools) (used in API tests scripts):
- [NodeJS](https://nodejs.org/) (>=10, using the latest LTS is recommended), [NVM](https://github.com/creationix/nvm) (allows greater version update flexibility)
- a [CouchDB](https://couchdb.apache.org/) (>=3.1) instance (on port 5984 for default config)
- an [Elasticsearch](https://www.elastic.co/fr/products/elasticsearch) (>=7.10) instance (on port 9200 for default config)

To install all this those dependencies on Debian/Ubuntu:

For packages available in Ubuntu default repositories:
```sh
sudo apt-get update
sudo apt-get install git curl wget graphicsmagick inotify-tools
```
For packages that need a more elaborated installation, see their own documentation:
* [Install NodeJS latest LTS via NVM](https://github.com/nvm-sh/nvm#installing-and-updating)
* [Install CouchDB](https://docs.couchdb.org/en/stable/install/unix.html)
* [Install ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html)

Alternatively, CouchDB and Elasticsearch could be run in Docker, see [docker-inventaire](https://github.com/inventaire/docker-inventaire)

Whatever the way you installed CouchDB and Elasticsearch, you should now be able to get a response from them:
```sh
# Verify that CouchDB is up
curl http://localhost:5984
# Verify that Elasticsearch is up
curl http://localhost:9200
```

### Project development environment installation
```sh
git clone https://github.com/inventaire/inventaire.git
cd inventaire
npm install --global tsx
npm install
```

This should have installed:
- the server (this git repository) in the current directory
- the client ([inventaire-client](https://github.com/inventaire/inventaire-client)) in the `client` directory
- i18n strings ([inventaire-i18n](https://github.com/inventaire/inventaire-i18n)) in the `inventaire-i18n` directory

#### server

The installation step above should have triggered the creation of a `./config/local.cjs` file, in which you can override all present in `./config/default.cjs`: make sure to set `db` `username` and `password` to your CouchDB username and password.

And now you should be all set! You can now start the server (on port `3006` by default)
```sh
# Starting the server in watch mode so that it reboots on file changes
npm run watch
```

##### emails

To debug emails in the browser:
* Get some username and password at https://ethereal.email/create and set the following values in config: `mailer.nodemailer.user` and `mailer.nodemailer.pass`.
* Make an action that triggers the email you would like to work on on the local server (ex: send a friend request)
* Open https://ethereal.email/messages to see the generated email

Note that, while convenient, debugging emails in the browser is quite an approximation, as some email clients are antiquated, and, sadly, modern CSS can't be used.

#### client

If you want to work on the [client](https://github.com/inventaire/inventaire-client), you need to start the webpack watcher and dev server (on port `3005` by default)
```sh
# In another terminal
cd inventaire/client
npm run watch
```

### Installation tips
* To use executable that are used by the project (such as `mocha`), you can either find them in `./node_modules/.bin` or install them globally with npm: `npm install -g tsx mocha lev2` etc.

### Repositories and Branches

#### [server](https://github.com/inventaire/inventaire)
- [**main**](https://github.com/inventaire/inventaire/tree/main): the stable branch. Unstable work should happen in feature-specific branches and trigger pull requests when ready to be merged in the main branch. See [Code Contributor Guidelines](https://github.com/inventaire/inventaire/wiki/Code-Contributor-Guidelines).

#### [client](https://github.com/inventaire/inventaire-client)
- [**main**](https://github.com/inventaire/inventaire-client/tree/main): the stable branch. Unstable work should happen in feature-specific branches and trigger pull requests when ready to be merged in the main branch. See [Code Contributor Guidelines](https://github.com/inventaire/inventaire/wiki/Code-Contributor-Guidelines).

#### [i18n](https://github.com/inventaire/inventaire-i18n)
The repository tracking strings used in the server (for emails, activitypub) and client (for the web UI) in all the supported languages. To contribute to translations, see the [Inventaire Weblate project](https://weblate.framasoft.org/engage/inventaire/)
- [**main**](https://github.com/inventaire/inventaire-i18n/tree/main): tracking translations fetched from [Weblate](https://weblate.framasoft.org/engage/inventaire/) and build scripts

#### [deploy](https://github.com/inventaire/inventaire-deploy)
tracking installation scripts to run inventaire in production (for production documentation, see [docs](https://git.inventaire.io/inventaire/tree/main/docs))
- [**main**](https://github.com/inventaire/inventaire-deploy/tree/main): the main implementation for Debian/Ubuntu systems. Additional branches can be started to document installation on other environments

#### [docker](https://github.com/inventaire/docker-inventaire)
- [**main**](https://github.com/inventaire/docker-inventaire/tree/main): tracking docker installation files

## Stack Map
This repository correspond to the the "Server" section in the [stack map](https://inventaire.github.io/stack/)

## Concepts map

The app has a few core concepts, see the [Glossary](https://wiki.inventaire.io/wiki/Glossary) for more detailed information

## Contribute
For code-related contributions, see [*How to contribute* on wiki.inventaire.io](https://wiki.inventaire.io/wiki/Technic#How_to_contribute).

## Documentation

### User documentation

Most of the user doc is on the [wiki](https://wiki.inventaire.io), especially in the [help section](https://wiki.inventaire.io/wiki/Help).

### Admin documentation

See the [production documentation](https://git.inventaire.io/inventaire/tree/main/docs).

### Technical documentation

The [technical wiki page](https://wiki.inventaire.io/wiki/Technic) gives a detailed explanation of the architectural choices.

See our not exhaustive [API](https://api.inventaire.io) documentation

## License
Inventaire is an open-sourced project licensed under [AGPLv3](./LICENSES/AGPL-3.0-only.txt).
