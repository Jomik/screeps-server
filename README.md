This is an alternative to [screepers/screeps-launcher]

### Why?
I believe that build and setup should happen during the build of a docker image.
The [screepers/screeps-launcher] does all setup and installation during the run of the image.

This image does all installation and setup during the build stage.
So to launch the server, it will only start the server.
A consequence is that mods and configuration should happen at build time.
Nothing prevents a user from accessing a shell in the container to add these things after the image has been built however.

## Usage

The recommended way to use this image is through docker compose.
An example set up with [screepsmod-mongo] can be seen in the compose file [docker-compose.yml](docker-compose.yml) in this repo.
This spins up a server with a mongo and redis service beside it.

A lighter version without [screepsmod-mongo] can be found in [docker-compose-lite.yml](docker-compose-lite.yml)

Copy your chosen compose file and run `docker-compose up`. You should see the services starting.
You can now access your private screeps server on `http://localhost:21025`

## What does the image contain?
By default the image is built with [screepsmod-auth] and [screepsmod-admin-utils].
We also have a built image with [screepsmod-mongo].

To add additional mods or bots, you would have to build the image yourself.

## Customisation
There are two ways to customise the bot. I would recommend customising the image and building it yourself, so that you have an snapshot of your setup.

### Customise the image

#### NPM
You can add mods and bots from npm by setting the `NPM_MODS` build arg.
`docker build -t screeps-server . --build-arg NPM_MODS="screepsmod-map-tool"` 
Note that we always add [screepsmod-auth] and [screepsmod-admin-utils], but you have to manually add [screepsmod-mongo].

#### Local
You can add local mods or bots by creating a directory in the `mods` directory. In the root of your directory you should create a `package.json` with a property `screeps_mod: true` or `screeps_bot: true`. You can then run `docker build -t screeps-server .`

### Update a running container
You can always open a shell in your container and add to the setup there.
If you use the above compose files, you would run `docker-compose exec screeps sh`.
You can then run `npm install -E screepsmod-map-tool`.

You can also add to the `mods` directory, `mods.json` and `.screepsrc`.

Remember to restart the container afterwards with `docker-compose restart screeps`.


[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
[screepsmod-auth]:(https://github.com/ScreepsMods/screepsmod-auth)
[screepsmod-admin-utils]:(https://github.com/ScreepsMods/screepsmod-admin-utils)
[screepsmod-mongo]:(https://github.com/ScreepsMods/screepsmod-mongo)