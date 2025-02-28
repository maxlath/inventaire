# Documentation

This folder hosts the main **technical documentation** about Inventaire, including how to setup a development or a production environment.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Install](#install)
- [Configure](#configure)
- [Administrate](#administrate)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Install

What you need to install will depend on if you are trying to setup a development or a production environment:
* In **development**, you will need the server and client repositories of course, and their dependencies: CouchDB, Elasticsearch, GraphicsMagick
* In **production**, in addition to those dependencies, you will need a reverse proxy, typically Nginx, to handle TLS termination, image resizing and caching, etc

For details on how to install all of those:
* See [installation](./installation) procedure for Debian-based systems.
* See [Docker Inventaire Suite](https://git.inventaire.io/docker-inventaire) for a fully packaged federated production-ready instance
* For other operating systems and setups, see [install on another OS](./installation/install.md#install-on-other-operating-systems)

### Configure

See [configuration]https://git.inventaire.io/inventaire/tree/main/docs/configuration) folder.

### Administrate

See [administration]https://git.inventaire.io/inventaire/tree/main/docs/administration) folder.
