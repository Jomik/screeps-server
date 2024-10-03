### Prerequisites
Check for new prerequisites and breaking changes

### Check for new version
You can see the latest images here [Docker Hub](https://hub.docker.com/repository/docker/jomik/screeps-server).

### Update docker image
Run `docker compose pull screeps` to download any new version of the image.
You can run `docker compose pull` without the `screeps` specifier to pull all new images for the compose file.

### Update mods and bots
Mods and bots can be updated by running `docker compose exec screeps start --update` and restarting the server. This will go over the
installed packages and update any that are not pinned to their latest available version. You can pin a package
to specific version in the config.yml, like so: `mod@1.2.3`.
