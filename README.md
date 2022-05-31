This is an alternative to [screepers/screeps-launcher]

## Why?
I believe that build and setup should happen during the build of a docker image.
The [screepers/screeps-launcher] does all setup and installation during the run of the image.

This image does all installation and setup during the build stage.
So to launch the server, it will only start the server.
Mods and bots are managed at startup by checking your `config.yml`.
`npm` is only invoked if changes are made to your `config.yml`.

## Installation (Recommended)
**Step 1: Clone/Download this repository.**

**Step 2:  Download Docker Desktop** 

- [Download](https://www.docker.com/products/docker-desktop/)

**Step 3: Open your download directory `.../screeps-server/`** 

**Step 4: Edit `config.yml`**

- Adjust other settings to your likings.
  - [Docs: screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth)
  - [Docs: screepsmod-admin-utils](https://github.com/ScreepsMods/screepsmod-admin-utils)

**Step 5:** Edit `.env.sample` by adding your Steam API Key

**Step 6: Use Docker to setup an instance.** 

	- Open a terminal
	- Navigate to your `screeps-server` directory. 
		- `cd /path/to/screeps-server/`
	- Run `docker compose up` (Press `CTRL + C` to stop the server again)
	- To open CLI run `docker compose exec screeps cli`
## Usage

**Launching The Server**

- ***Via Docker Desktop***
	
	- If you installed everything properly using the recommended settings above, you can simply launch `Docker Desktop` and you'll see an option there for `screeps-server` which contains instances of screeps, mongo, and redis. Simply hit the `Play/Start` button on the `screeps_server` section.
- ***Via Docker Cli***
	- Navigate to your `screeps-server` directory.
	- Run `docker compose up`

**Launching The CLI**

- Navigate to your `screeps-server` directory.
- Run `docker compose exec screeps cli`

## Customization
Customization is handled through `config.yml` located in your `screeps-server` directory.
```yml
mods:
  - screepsmod-auth
  - screepsmod-admin-utils
  - screepsmod-mongo
bots:
  simplebot: screepsbot-zeswarm
  overmind: screeps-bot-overmind
```

## Troubleshooting
- Help, my server is running but I can't connect.
  - Follow the instructions for [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth)
- I can't push any code via `rollup` to my server.
  - Make sure your `screeps.json` configuration in your project is set properly. 
  - In your `email:` field, simply put in your `username`. Verify your password is the same as your `screepsmod-auth` setting.
- My map is all red, I can't actually spawn in!
  - Restart your server, check your configuration and follow the instructions for [screepsmod-admin-utils](https://github.com/ScreepsMods/screepsmod-admin-utils)

## Resources & Docs
[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
[screepsmod-auth]: https://github.com/ScreepsMods/screepsmod-auth
[screepsmod-admin-utils]: https://github.com/ScreepsMods/screepsmod-admin-utils
[screepsmod-mongo]: https://github.com/ScreepsMods/screepsmod-mongo
