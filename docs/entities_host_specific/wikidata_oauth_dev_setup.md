# How to setup a development OAuth setup for Wikidata

## Purpose

To test or develop locally, one may need to connect a Wikidata account on their locally installed server instance (ie. in order to edit Wikidata items from the localhost inventaire interface).

## Caution

Editing Wikidata entities (known as items in Wikidata's lexic) shall not be done uncarefully, please consider editing accurate values, or edit [one of the sandbox items](https://www.wikidata.org/wiki/Q4115189).

## Prerequisite

- Provide valid [OAuth application credentials](https://www.wikidata.org/wiki/Special:OAuthListConsumers/) (to be asked from a Wikidata admin)
- Create a dedicated Wikidata user (or use an existing one).

## Setup

- In `config/local.cjs` paste the OAuth application credentials:
```js
wikidataOAuth: {
  consumer_key: 'key',
  consumer_secret: 'secret',
},
```

- Temporarly bridge the server port to http://localhost, ie. with a local nginx server (and do not forget to disable your firewall) :

```nginx
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  location / {
    proxy_pass http://localhost:[localPort];
  }
}
```

- Log in you local server and navigate to wikidata entity edit page (ie. `http://localhost:[localPort]/entity/wd:Q2833411/edit`) and click on `Connect to Wikidata` to fetch some OAuth token

- Once OAuth token are retrived, you may disable nginx setup, and start editing Wikidata from your local inventaire instance.
