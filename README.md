This is an alternative to [screepers/screeps-launcher]

### Why?
I believe that build and setup should happen during the build of a docker image.
The [screepers/screeps-launcher] does all setup and installation during the run of the image.

This image does all installation and setup during the build stage.
So to launch the server, it will only start the server.
Mods and bots are managed at startup by checking your `config.yml`.
`npm` is only invoked if changes are made to your `config.yml`.

## Usage

The recommended way to use this image is through docker compose.
An example setup with [screepsmod-mongo] can be seen in the compose file [docker-compose.yml](docker-compose.yml) in this repo.
This spins up a server with a mongo and redis service beside it.
Remember that `screepsmod-mongo` must be in the list of mods in your `config.yml`

Copy the compose file and run `docker compose up`. You should see the services starting.
You can now access your private screeps server on `http://localhost:21025`

A lighter alternative without mongo and redis could look like this
```yml
version: '3'
services:
  screeps:
    image: jomik/screeps-server:latest
    volumes:
      - ./config.yml:/screeps/config.yml
      - screeps-data:/data
    ports:
      - 21025:21025/tcp
    environment:
      STEAM_KEY: ${STEAM_KEY:?"Missing steam key"}
    restart: unless-stopped

volumes:
  screeps-data:

```

To access the CLI you can use `docker compose exec screeps cli`

## Customisation

Customisation is handled through `config.yml`. An example can be found in [config.sample.yml](config.sample.yml).
```yml
mods:
  - screepsmod-auth
  - screepsmod-admin-utils
  - screepsmod-mongo
bots:
  simplebot: screepsbot-zeswarm
  overmind: screeps-bot-overmind
```


[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
[screepsmod-auth]: https://github.com/ScreepsMods/screepsmod-auth
[screepsmod-admin-utils]: https://github.com/ScreepsMods/screepsmod-admin-utils
[screepsmod-mongo]: https://github.com/ScreepsMods/screepsmod-mongo
