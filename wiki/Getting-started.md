# Quickstart Guide

A working [Docker](https://www.docker.com/) installation.
You can use [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

Download the [compose file](../docker-compose.yml), [envfile](../.env.sample), [configuration file](../config.yml) to your computer. You can put this in your Screeps project.
Copy `.env.sample` to `.env`, this can hold secrets for you, and should be ignored in git!
You can also get the [package.json file](../package.json) because it has scripts set up for quick server administration. You'll need `npm` available for that, and this is only because of the `scripts` section in it, so running `npm install` is entirely unnecessary.

You can use this command (in a shell) to do the above, in your current directory.

```sh
curl --remote-name-all https://raw.githubusercontent.com/Jomik/screeps-server/main/{docker-compose.yml,.env.sample,config.yml} && cp .env.sample .env && echo ".env" >> .gitignore
```

That snippet does not download `package.json`; grab the administration scripts and merge them in your own package.json if you want to use them.

Paste the value labeled `Key` from your [Steam API key](https://steamcommunity.com/dev/apikey) into `.env`.

## Starting the server

In your project run `npm run start`/`docker compose up -d`.
Run `npm run start:logs`/`docker compose logs screeps -f` to view and follow the logs for the screeps-server container.
To stop following the logs, press `CTRL + C`.
Assuming nothing went wrong, you should be able to connect to your server on `http://localhost:21025`.

## Stopping the server

In your project run `npm run stop`/`docker compose stop`. This will stop the containers, but not remove them, so starting is quicker again.

If you want to manually recreate containers, you can do so with `npm run reset`/`docker compose down`. This keeps the volumes so the server data will be kept and restarting the server will recreate the containers.

To __fully__ wipe the server and its data, run `npm run reset:hard`/`docker compose down -v`. This removes containers, networks and volumes.

## Checking the logs

Once the server is running, you can inspect what it's doing with `npm run logs`/`docker compose logs -ft -n 100 screeps`. Generally you also want `logConfig: true` in config.yml so the screeps server redirects its output into the standard output, which is what Docker collects into its logs.

## Connecting to the server's CLI
With the server running, you can `npm run cli`/`docker compose exec screeps cli` to connect to the server's administration console. See the [Screepspl.us wiki](https://wiki.screepspl.us/Private_Server_Common_Tasks/) for more information.

One-off commands can be run through the `cli` script's `-c` parameter, so `npm run cli -- -c 'system.pauseSimulation();'`/`docker compose exec screeps cli -c 'system.pauseSimulation()'` will pause the server.
