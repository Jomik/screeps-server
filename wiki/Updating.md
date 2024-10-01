### Prerequisites
Check for new prerequisites and breaking changes

### Check for new version
You can see the latest images here [Docker Hub](https://hub.docker.com/repository/docker/jomik/screeps-server).

### Update docker image
Run `docker compose pull screeps` to download any new version of the image.
You can run `docker compose pull` without the `screeps` specifier to pull all new images for the compose file.

### Update mods and bots
Those that have specific versions set in `config.yml` can be updated by changing that.
To update mods/bots that was installed without a version requirement (defaults to @latest at time of first startup) will have to be updated from within the container.
See [Issue #23](https://github.com/Jomik/screeps-server/issues/23)