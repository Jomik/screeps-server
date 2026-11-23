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

Pull request CI builds and starts the server on Node.js 22 and 24 and checks health, mods, and bots; a working `STEAM_KEY` is required.
Same-repository PR runs can use the repository's `STEAM_KEY` secret.
A `pull_request` from a fork targeting this repository runs here with neither this repository's nor the fork's `STEAM_KEY`, so startup integration fails without the key.
To test with your own key, enable Actions in your fork, add `STEAM_KEY` as a fork repository secret, and open a PR from a branch against that fork's `main` (the workflow only triggers on PRs targeting `main`).

[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
