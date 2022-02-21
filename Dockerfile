FROM node:12-alpine as screeps

# Install node-gyp dependencies 
RUN apk add --no-cache python2 make gcc g++

# Install screeps
WORKDIR /server
RUN npm init -y
RUN npm install --save-exact screeps

# Initialize screeps, similar to `screeps init`
WORKDIR /server/node_modules/@screeps/launcher/init_dist
RUN cp -a .screepsrc db.json node_modules/ mods.json /server/.

# Gotta remove this Windows carriage return shenanigans
WORKDIR /server
RUN sed -i "s/\r//" .screepsrc ./node_modules/.hooks/install ./node_modules/.hooks/uninstall
# Make hooks runnable
RUN chmod +x ./node_modules/.hooks/install ./node_modules/.hooks/uninstall

FROM node:12-alpine as server

COPY --from=screeps --chown=node /server /server/

USER node
WORKDIR /server

# Install custom mods
ARG NPM_MODS="screepsmod-auth screepsmod-admin-utils"
RUN test -z "${NPM_MODS}" || npm install -E ${NPM_MODS}

# Install local mods
COPY --chown=node ./mods ./local-mods
RUN test -z "$(ls ./local-mods/)" || npm install -E ./local-mods/*

EXPOSE 21025
ENTRYPOINT [ "node", "/server/node_modules/.bin/screeps" ,"start", "--steam_api_key", "${STEAM_KEY}" ]
