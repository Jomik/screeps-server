# Backups and restores

Your world data lives in MongoDB (game database) and Redis (live state). Backups let you save that data to files so you can move servers, recover from mistakes, or keep a snapshot before big changes.

The compose stack defines a backup tool, that mounts the Docker socket and your workspace so it can drive `docker compose` the same way you would on the host. Backup files are written to a `backups` folder next to your compose file. It is recommended to `.gitignore` that directory if you are using git.

Each backup consists of two files that share a prefix:

- **`<prefix>.mongo.archive`** — a copy of the MongoDB database
- **`<prefix>.redis.rdb`** — a copy of the Redis data 

If you run a backup *without* choosing a name, the prefix is a timestamp (so filenames look like a date and time). You can also pick a name you will remember, for example before an upgrade:

```sh
npm run backup -- before-upgrade
```
or alternatively
```sh
docker compose --profile tools run --rm backup-tool backup before-upgrade
```

## Creating a backup

With the server stack running:

```sh
npm run backup
```
or
```sh
docker compose --profile tools run --rm backup-tool backup
```

The tool pauses the server, backs up Mongo and Redis, then resumes. This means players only see a paused world during the backup window instead of a hard disconnect from stopping the container.

If a command errors and you need more detail, add `-vv`. A lighter `-v` prints the underlying commands without flooding the terminal with Docker’s full logs.

## Restoring a backup

⚠️ **This replaces live data on the server.** Only restore when you mean to, and ideally try on a test copy first.

1. Find the prefix — the part of the filename before `.mongo.archive` or `.redis.rdb`.
2. From the root of the server installation, run restore with that prefix.

With npm you need to add a `--` so the prefix is passed to the tool correctly:

```sh
npm run restore -- 20260113-120000
```

```sh
docker compose --profile tools run --rm backup-tool restore 20260113-120000
```

You may pass something like `backups/20260113-120000` or a full filename; the tool figures out the prefix.

The game server stays off while data is put back; Redis is restarted so it picks up the restored files.
