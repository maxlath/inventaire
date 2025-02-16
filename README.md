# Inventaire

Libre collaborative resource mapper powered by open-knowledge<br>
[![License](https://img.shields.io/badge/license-AGPL3-blue.svg)](http://www.gnu.org/licenses/agpl-3.0.html)
[![Node](https://img.shields.io/badge/node->=v4-brightgreen.svg)](https://nodejs.org)
[![Code Climate](https://codeclimate.com/github/inventaire/inventaire/badges/gpa.svg)](https://codeclimate.com/github/inventaire/inventaire)<br>
<br>
[![chat](https://img.shields.io/badge/chat-%23inventaire-ffd402.svg)](https://riot.im/app/#/room/#freenode_#inventaire:matrix.org)
[![wiki](https://img.shields.io/badge/wiki-general-319cc2.svg)](https://wiki.inventaire.io)

[![inventory screenshot](https://github.com/inventaire/inventaire/assets/1596934/844c04ff-a216-48dc-b3b9-c33a106b8fbe)](https://inventaire.io)

This repository hosts [Inventaire.io](https://inventaire.io) source code. Its a collaborative resources mapper project, while yet only focused on exploring books mapping with [wikidata](https://wikidata.org/) and [ISBNs](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

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

*This is the installation documentation for a developement environment. For production setup, see*: [inventaire-deploy](https://github.com/inventaire/inventaire-deploy)

### Dependencies to install manually
- [git](https://git-scm.com/), [curl](https://curl.haxx.se) (used in some installation scripts), [graphicsmagick](www.graphicsmagick.org/README.html) (used to resize images), [inotify-tools](https://github.com/rvoicilas/inotify-tools) (used in API tests scripts):
- [NodeJS](https://nodejs.org/) (>=10, using the latest LTS is recommended), [NVM](https://github.com/creationix/nvm) (allows greater version update flexibility)
- a [CouchDB](https://couchdb.apache.org/) (>=3.1) instance (on port 5984 for default config)
- an [Elasticsearch](https://www.elastic.co/fr/products/elasticsearch) (>=7.10) instance (on port 9200 for default config)

To install all this those dependencies on Ubuntu 20.04:

For packages available in Ubuntu default repositories:
```sh
sudo apt-get update
sudo apt-get install git curl wget graphicsmagick inotify-tools
```
For packages that need a more elaborated installation, see their own documentation:
* [Install NodeJS latest LTS via NVM](https://github.com/nvm-sh/nvm#installing-and-updating)
* [Install CouchDB](https://docs.couchdb.org/en/stable/install/unix.html)
* [Install ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.14/deb.html)

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
The repository tracking strings used in the server (for emails, activitypub) and client (for the web UI) in all the supported languages. For helping to translate, see the [Inventaire Weblate project](https://weblate.framasoft.org/engage/inventaire/)
- [**main**](https://github.com/inventaire/inventaire-i18n/tree/main): tracking translations fetched from [Weblate](https://weblate.framasoft.org/engage/inventaire/) and build scripts

#### [deploy](https://github.com/inventaire/inventaire-deploy)
tracking installation scripts and documentation to run inventaire in production
- [**main**](https://github.com/inventaire/inventaire-deploy/tree/main): the main implementation targeting Ubuntu 16.04. Additional branches can be started to document installation on other environments

#### [docker](https://github.com/inventaire/docker-inventaire)
- [**main**](https://github.com/inventaire/docker-inventaire/tree/main): tracking docker installation files for development and testing use

## Stack Map
This repository correspond to the the "Server" section in the [stack map](https://inventaire.github.io/stack/)

## Concepts map

The app has a few core concepts, see the [Glossary](https://wiki.inventaire.io/wiki/Glossary) for more detailed information

## Contribute
For code-related contributions, see [*How to contribute* on wiki.inventaire.io](https://wiki.inventaire.io/wiki/Technic#How_to_contribute).

## Documentation
see [docs](https://github.com/inventaire/inventaire/tree/main/docs/)

## Wiki
see [wiki.inventaire.io](https://wiki.inventaire.io)
You may want to directly go to the [technical wiki page](https://wiki.inventaire.io/wiki/Technic)

## API
see wiki: [API](https://wiki.inventaire.io/wiki/Technic#About_the_API)

## Administration
see [Administration](./docs/administration.md)

## License
Inventaire is an open-sourced project licensed under [AGPLv3](./LICENSES/AGPL-3.0-only.txt).
