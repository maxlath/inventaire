# Install a reverse proxy

> ⚠️ You do not need a reverse proxy in development, only in production.

The only offical documentation is with Ngnix, but other reverse proxy should work. We use Nginx for more than reverse proxy though: it is also used as a static file server, and an image cache.

## Prerequisites

- Having Nginx and openssl installed
- Some knowledge about how to write Nginx configuration files, see [Nginx documentating](http://nginx.org/en/docs/)

## Configure

### Download templates

You may prefer to set up a "light" Nginx setup done for the Docker repository.

```sh
wget https://git.inventaire.io/docker-inventaire/blob/main/nginx/templates/default.conf.template
```

(for information, inventaire.io is using a more complicated version available in the [inventaire-deploy](https://github.com/inventaire/inventaire-deploy/blob/main/nginx/inventaire.original.nginx) repository.)

Add the snippets:

```sh
wget https://raw.githubusercontent.com/inventaire/inventaire-deploy/refs/heads/main/nginx/security_headers.conf
wget https://raw.githubusercontent.com/inventaire/inventaire-deploy/refs/heads/main/nginx/ssl.conf
cp ssl.conf security_headers.conf /etc/nginx/snippets
```

### Setup the environment variables

```sh
DOMAIN_NAME=your-domain-name.org
```

Check that `PROJECT_ROOT` has already been set:

```sh
echo $PROJECT_ROOT
```

### Generate the Nginx file

```sh
cat default.conf.template |
 sed "s@PROJECT_ROOT@$PROJECT_ROOT@g" |
 sed "s@DOMAIN_NAME@$DOMAIN_NAME@g" > /etc/nginx/sites-enabled/default
```

### Other dependencies

Generate dhparam.pem file

```sh
openssl dhparam -out /etc/nginx/dhparam.pem 2048
```


```sh
mkdir -p /tmp/nginx/tmp /tmp/nginx/resize/img/users /tmp/nginx/resize/img/groups /tmp/nginx/resize/img/entities /tmp/nginx/resize/img/remote /tmp/nginx/resize/img/assets
# You know need to give ownership of those directories to the nginx user,
# otherwise, you would get premission errors in the nginx logs, as it fails to save files.
# Sometimes that user is `nginx`, sometimes `www-data`, let's find out:
NGINX_USER=$(grep '^user' /etc/nginx/nginx.conf | awk -F '( |;)' '{print $2}')
chown -R $NGINX_USER:$NGINX_USER /tmp/nginx
```

Reload nginx

```sh
sudo nginx -s reload
```
