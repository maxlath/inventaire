# Install Elasticsearch

## in Docker
See [docker-inventaire](https://github.com/inventaire/docker-inventaire).

## on Debian-based systems

Inventaire use Elasticsearch `v7`. For the exact version, you can check the one used in the [docker-compose file](https://github.com/inventaire/docker-inventaire/blob/main/docker-compose.yml), and follow the corresponding official install guide. ie. for version 7.17: https://www.elastic.co/guide/en/elasticsearch/reference/7.17/install-elasticsearch.html . But if your repository gives you some `v7` version, that should be fine.

## Configure

You may use systemd to restart on failure

See:
  - https://github.com/elastic/elasticsearch/issues/25425
  - https://github.com/elastic/puppet-elasticsearch/pull/870
  - https://www.digitalocean.com/community/tutorials/understanding-systemd-units-and-unit-files

```sh
sudo mkdir -p /etc/systemd/system/elasticsearch.service.d
echo '
[Unit]
StartLimitInterval=200
StartLimitBurst=5

[Service]
Restart=always
RestartSec=3
Environment=ES_JAVA_OPTS="-Xms2g -Xmx2g"
' | sudo tee /etc/systemd/system/elasticsearch.service.d/override.conf
```

## Start ElasticSearch at startup

```sh
sudo systemctl daemon-reload
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

## Disabling GeoIP

See https://www.elastic.co/guide/en/elasticsearch/reference/current/geoip-processor.html
and https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-update-settings.html


```sh
curl -H 'content-type: application/json' -XPUT "http://localhost:9200/_cluster/settings" -d '{
  "persistent" : {
    "ingest.geoip.downloader.enabled" : false
  }
}'
```
