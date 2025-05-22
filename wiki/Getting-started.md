### Prerequisites

A working [Docker](https://www.docker.com/) installation.
You can use [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Setup

Download the [compose file](./docker-compose.yml), [envfile](./.env.sample) and [configuration](./config.yml) file to your computer. You can put this in your Screeps project.
Copy `.env.sample` to `.env`, this can hold secrets for you, and should be ignored in git!

You can use this command (in a shell) to do the above, in your current directory.

```sh
curl --remote-name-all https://raw.githubusercontent.com/Jomik/screeps-server/main/{docker-compose.yml,.env.sample,config.yml} && cp .env.sample .env && echo ".env" >> .gitignore
```

Paste your [Steam API key](https://steamcommunity.com/dev/apikey)((the value labeled `Key`) into `.env`.
### Starting the server

In your project run `docker compose up -d`.
Run `docker compose logs screeps -f` to view and follow the logs for the screeps-server container.
To stop following the logs, press `CTRL + C`.
Assuming nothing went wrong, you should be able to connect to your server on `http://localhost:21025`.

### Stopping the server
In your project run `docker compose stop`. This will stop the containers, but not remove them, so starting is quicker again.

To __fully__ wipe the server and its data, run `docker compose down -v`. This removes containers, networks and volumes.
