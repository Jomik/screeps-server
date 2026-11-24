# Quickstart Guide

A working [Docker](https://www.docker.com/) installation.
You can use [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

Download the [compose file](../docker-compose.yml), [envfile](../.env.sample), [configuration file](../config.yml), and [nginx config](../nginx-custom.conf) to your computer. You can put this in your Screeps project.
Copy `.env.sample` to `.env`, this can hold secrets for you, and should be ignored in git!
You can also get the [package.json file](../package.json) because it has scripts set up for quick server administration. You'll need `npm` available for that, and this is only because of the `scripts` section in it, so running `npm install` is entirely unnecessary.

You can use this command (in a shell) to do the above, in your current directory.

```sh
curl --remote-name-all https://raw.githubusercontent.com/Jomik/screeps-server/main/{docker-compose.yml,.env.sample,config.yml,nginx-custom.conf} && cp .env.sample .env && echo ".env" >> .gitignore
```

That snippet does not download `package.json`; grab the administration scripts and merge them in your own package.json if you want to use them.

Paste the value labeled `Key` from your [Steam API key](https://steamcommunity.com/dev/apikey) into `.env`.

## Starting the server

In your project run `npm run start`/`docker compose up -d`.
Run `npm run start:logs`/`docker compose logs screeps -f` to view and follow the logs for the screeps-server container.
To stop following the logs, press `CTRL + C`.
Assuming nothing went wrong, you should be able to connect to your server on `http://localhost:21025`.

## HTTPS

To serve the server over HTTPS, set these in `.env`:

```
COMPOSE_PROFILES=https
SERVER_HOSTNAME=your.public.name
LETSENCRYPT_EMAIL=you@example.com
```

`COMPOSE_PROFILES` applies to every Compose command in this directory, including the npm scripts, so you do not pass `--profile https` each time. You can still pass that flag for a single command instead of setting the variable.

Port 80 and 443 on this machine must be reachable at `SERVER_HOSTNAME` so Let's Encrypt can issue the certificate. Port 80 answers the ACME challenge and redirects every other request to HTTPS. The web client and `node-screeps-api` then use `https://<SERVER_HOSTNAME>/`. The first start can take a minute while the certificate is issued.

The official client cannot use HTTPS, so the plain HTTP stays accessible on port 21025, at `http://<SERVER_HOSTNAME>:21025`.

## HTTPS on localhost

Let's Encrypt will not issue a certificate for a name that only resolves on this machine. Leave `COMPOSE_PROFILES` unset and use `http://127.0.0.1:21025`.

If you still want HTTPS for a name that resolves locally, set `SERVER_HOSTNAME` to that name and run `bash tools/make-cert.sh` from the project directory. The script writes a two-day self-signed certificate, starts nginx without the Let's Encrypt companion, and copies the certificate in. If the companion is already running, the script stops it so it cannot replace that certificate.

When you open `https://<SERVER_HOSTNAME>/`, your browser will warn because the certificate is untrusted — it's self-signed after all — so you'll have to override that. If you're using Node to connect to it (via `node-screeps-api` for example), you can use `NODE_EXTRA_CA_CERTS=./<SERVER_HOSTNAME>.crt` to insert that self-signed certificate.

A later `docker compose up -d` with `COMPOSE_PROFILES=https` and a public `SERVER_HOSTNAME` starts the companion and replaces this with a Let's Encrypt certificate.

## Stopping the server

In your project run `npm run stop`/`docker compose stop`. This will stop the containers, but not remove them, so starting is quicker again.

If you want to manually recreate containers, you can do so with `npm run reset`/`docker compose down`. This keeps the volumes so the server data will be kept and restarting the server will recreate the containers.

To __fully__ wipe the server and its data, run `npm run reset:hard`/`docker compose down -v`. This removes containers, networks and volumes.

## Checking the logs

Once the server is running, you can inspect what it's doing with `npm run logs`/`docker compose logs -ft -n 100 screeps`. Generally you also want `logConfig: true` in config.yml so the screeps server redirects its output into the standard output, which is what Docker collects into its logs.

## Connecting to the server's CLI
With the server running, you can `npm run cli`/`docker compose exec screeps cli` to connect to the server's administration console. See the [Screepspl.us wiki](https://wiki.screepspl.us/Private_Server_Common_Tasks/) for more information.

One-off commands can be run through the `cli` script's `-c` parameter, so `npm run cli -- -c 'system.pauseSimulation();'`/`docker compose exec screeps cli -c 'system.pauseSimulation()'` will pause the server.
