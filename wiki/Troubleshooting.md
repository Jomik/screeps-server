### Help, my server is running but I can't connect.
  - Follow the instructions for [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth)
### I can't push any code via `rollup` to my server.
  - Make sure your `screeps.json` configuration in your project is set properly.
  - In your `email:` field, simply put in your `username`. Verify your password is the same as your `screepsmod-auth` setting.
### My map is all red, I can't actually spawn in!

  - This is most likely a result of your map not loaded properly on first-run. To fix it do the following.

    - Step 1: Navigate to your server file location in terminal/powershell.
    - Step 2: Run `docker compose exec screeps cli`
    - Step 3: Run `system.resetAllData()` and reconnect.

  - Restart your server, check your configuration and follow the instructions for [screepsmod-admin-utils](https://github.com/ScreepsMods/screepsmod-admin-utils)