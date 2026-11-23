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

Pull request CI tests the server on Node.js 22 and 24, including startup tests that require a real `STEAM_KEY`.
Same-repository runs can use the repository's `STEAM_KEY` secret.
Upstream fork PR runs receive neither the upstream nor the fork's `STEAM_KEY`, so startup tests cannot pass without it.
A fork-owned secret is usable only in a workflow run hosted in that fork; an ordinary upstream `pull_request` run does not inherit it.

[screepers/screeps-launcher]: https://github.com/screepers/screeps-launcher
