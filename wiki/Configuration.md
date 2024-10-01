Edit `config.yml` to add mods and bots. Some mods also look there for configuration.
The mods and bots are installed using `npm install`, thus you can use anything that it recognizes as [a valid package](https://docs.npmjs.com/cli/v6/commands/npm-install).

### Defaults
We currently add the following mods, as default:

- [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth)
- [screepsmod-admin-utils](https://github.com/ScreepsMods/screepsmod-admin-utils)
- [screepsmod-mongo](https://github.com/ScreepsMods/screepsmod-mongo)

### Mods
Mods are managed by changing the `mods` YAML list in `config.yml`.
Here is an example where we remove `mongo` and add `cli`
```diff
mods:
  - screepsmod-auth
  - screepsmod-admin-utils
-  - screepsmod-mongo
+  - screepsmod-cli
```

### Bots
Bots are managed by changing the `bots` object in `config.yml`. The key is the name you wish to use for the bot, the value is the package.
```diff
bots:
-  simplebot: screepsbot-zeswarm
+  zeswarm: screepsbot-zeswarm
+  quorom: screepsbot-quorum
```

### Server options
We can set options specific to the server. Here is an example that forwards log messages to the terminal.
```diff
serverOptions:
-  logConsole: false
+  logConsole: true
```