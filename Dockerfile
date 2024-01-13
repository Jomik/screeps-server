ARG NODE_VERSION=10
FROM node:${NODE_VERSION}-alpine as screeps

# Install node-gyp dependencies
# We do not pin as we use multiple node versions.
# They are so old that there is no changes to their package registry anyway..
# hadolint ignore=DL3018
RUN --mount=type=cache,target=/etc/apk/cache \
  apk add --no-cache bash python2 make gcc g++

# Install screeps
WORKDIR /screeps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm clean-install

# Initialize screeps, similar to `screeps init`
RUN cp -a /screeps/node_modules/@screeps/launcher/init_dist/.screepsrc ./ && \
  cp -a /screeps/node_modules/@screeps/launcher/init_dist/db.json ./ && \
  cp -a /screeps/node_modules/@screeps/launcher/init_dist/assets/ ./

# Gotta remove this Windows carriage return shenanigans
RUN sed -i "s/\r//" .screepsrc

FROM node:${NODE_VERSION}-alpine as server
# hadolint ignore=DL3018
RUN --mount=type=cache,target=/var/cache/apk \
  apk add --no-cache git

USER node
COPY --from=screeps --chown=node:node /screeps /screeps/

# Init mods package
WORKDIR /screeps/mods
RUN npm init -y

# Move the database file to shared directory
WORKDIR /data
RUN mv /screeps/db.json /data/db.json && \
  sed -i "s/db.json/\/data\/db.json/" /screeps/.screepsrc

WORKDIR /screeps
COPY screeps-cli.js ./bin/cli
COPY screeps-start.js ./bin/start
ENV SERVER_DIR=/screeps NODE_ENV=production PATH="/screeps/bin:${PATH}"

VOLUME [ "/data" ]
EXPOSE 21025

HEALTHCHECK --start-period=5m --interval=5m --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:21025/ || exit 1

ENTRYPOINT ["start"]
