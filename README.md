This is an alternative to [screepers/screeps-launcher].

## Why?

I believe that build and setup should happen during the build of a docker image.
The [screepers/screeps-launcher] does all setup and installation during the run of the image.

This image does all installation and setup during the build stage.
So to launch the server, it will only start the server.
Mods and bots are managed at startup by checking your `config.yml`.
`npm` is only invoked if changes are made to your `config.yml`.

## Getting started, configuration, updating and troubleshooting

Please check the [wiki](https://github.com/Jomik/screeps-server/wiki)! I will try to keep that one up to date.

## Contributing and CI

Pull request CI builds and starts the server on Node.js 22 and 24 and checks health, mods, and bots.
CI supplies a public `STEAM_KEY` placeholder, so no repository or fork Steam secret setup is needed, including for fork PRs.
Steam authentication is not covered by CI; a valid key is still required for real Steam login.

[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
