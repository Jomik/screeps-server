![Docker Pulls](https://img.shields.io/docker/pulls/jomik/screeps-server?link=https%3A%2F%2Fhub.docker.com%2Fr%2Fjomik%2Fscreeps-server)

This is an alternative to [screepers/screeps-launcher]

## Why?

I believe that build and setup should happen during the build of a docker image.
The [screepers/screeps-launcher] does all setup and installation during the run of the image.

This image does all installation and setup during the build stage.
So to launch the server, it will only start the server.
Mods and bots are managed at startup by checking your `config.yml`.
`npm` is only invoked if changes are made to your `config.yml`.

## Getting started

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

Paste your [Steam API key](https://steamcommunity.com/dev/apikey) into `.env`.

### Configuration

Edit `config.yml` to add mods and bots. Some mods also look there for configuration.
We currently add the following mods, as default:

- [screepsmod-auth]
- [screepsmod-admin-utils]
- [screepsmod-mongo]

### Starting the server

In your project run `docker compose up -d`.
Run `docker compose logs screeps -f` to view and follow the logs for the screeps-server container.
To stop following the logs, press `CTRL + C`.
Assuming nothing went wrong, you should be able to connect to your server on `http://localhost:21025`.

### Accessing the CLI

Run `docker compose exec screeps cli`.

It is also possible to access the from outside the container via a REST API.
This can be accomplished using [screepsmod-cli].
Simply add it to your `config.yml` and configure it appropriately according to the [readme](https://github.com/glitchassassin/screepsmod-cli/tree/main#readme).

### Updating

Ensure that your setup applies to any new prerequisites listed above.
Run `docker compose pull` to download any new version of the image.

### Stopping the server
In your project run `docker compose stop`. This will stop the containers, but not remove them, so starting is quicker again.

To __fully__ wipe the server and its data, run `docker compose down -v`. This removes containers, networks and volumes.

## Troubleshooting

- Help, my server is running but I can't connect.
  - Follow the instructions for [screepsmod-auth]
- I can't push any code via `rollup` to my server.
  - Make sure your `screeps.json` configuration in your project is set properly.
  - In your `email:` field, simply put in your `username`. Verify your password is the same as your `screepsmod-auth` setting.
- My map is all red, I can't actually spawn in!

  - This is most likely a result of your map not loaded properly on first-run. To fix it do the following.

    - Step 1: Navigate to your server file location in terminal/powershell.
    - Step 2: Run `docker compose exec screeps cli`
    - Step 3: Run `system.resetAllData()` and reconnect.

  - Restart your server, check your configuration and follow the instructions for [screepsmod-admin-utils]

[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
[screepsmod-auth]: https://github.com/ScreepsMods/screepsmod-auth
[screepsmod-admin-utils]: https://github.com/ScreepsMods/screepsmod-admin-utils
[screepsmod-mongo]: https://github.com/ScreepsMods/screepsmod-mongo
[screepsmod-cli]: https://github.com/glitchassassin/screepsmod-cli
