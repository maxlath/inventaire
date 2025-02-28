# Privacy-friendly analytics service

Inventaire may use [matomo](http://matomo.org) (ex-Piwik) to provide analytics.

## About Matomo

See the [integration guide](https://developer.matomo.org/guides/integrate-introduction) to grasp how to plug your inventaire instance with an existing Matomo service.


## Setup the inventaire config

In `config/local.cjs`:

```js
module.exports = {
  ...
  matomo: {
    enabled: true,
    endpoint: 'https://a-matomo-instance/matomo.php',
    idsite: 1,
    rec: 1
  },
```

