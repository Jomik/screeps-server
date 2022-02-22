FROM node:12-alpine as screeps

# Install node-gyp dependencies 
RUN apk add --no-cache python2 make gcc g++

# Install screeps
WORKDIR /server
RUN npm init -y
RUN npm install --save-exact screeps

# Initialize screeps, similar to `screeps init`
WORKDIR /server/node_modules/@screeps/launcher/init_dist
RUN cp -a .screepsrc db.json mods.json node_modules/ assets/ /server/.

# Gotta remove this Windows carriage return shenanigans
WORKDIR /server
RUN sed -i "s/\r//" .screepsrc ./node_modules/.hooks/install ./node_modules/.hooks/uninstall
# Make hooks runnable
RUN chmod +x ./node_modules/.hooks/install ./node_modules/.hooks/uninstall

FROM node:12-alpine as server

COPY --from=screeps --chown=node /server /server/
RUN mkdir /data && chown node /data

USER node
WORKDIR /server

# Move the database file to shared directory
RUN mv db.json /data/db.json && \
  sed -i "s/db.json/\/data\/db.json/" .screepsrc

# Install default mods
RUN npm install -E screepsmod-auth screepsmod-admin-utils

# Install custom mods
ARG NPM_MODS=""
RUN test -z "${NPM_MODS}" || npm install -E ${NPM_MODS}

# Install local mods
COPY --chown=node ./mods ./local-mods
RUN test -z "$(ls ./local-mods/)" || npm install -E ./local-mods/*

VOLUME [ "/data" ]
EXPOSE 21025
ENTRYPOINT [ "node", "/server/node_modules/.bin/screeps" ,"start", "--steam_api_key", "${STEAM_KEY}" ]
