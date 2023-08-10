ARG NODE_VERSION=10
# TODO: Specify this in pipeline.
# Setup pipelines to run on npm hook.
# Requires proxy...
ARG SCREEPS_VERSION=latest
FROM node:${NODE_VERSION}-alpine as screeps

# Install node-gyp dependencies
# We do not pin as we use multiple node versions.
# They are so old that there is no changes to their package registry anyway..
# hadolint ignore=DL3018
RUN --mount=type=cache,target=/etc/apk/cache \
  apk add --no-cache python2 make gcc g++

# Install screeps
WORKDIR /server
RUN --mount=type=cache,target=/root/.npm \
  npm install --save-exact "screeps@${SCREEPS_VERSION}" "js-yaml@4.1.0"

# Initialize screeps, similar to `screeps init`
WORKDIR /server/node_modules/@screeps/launcher/init_dist
RUN cp -a .screepsrc db.json assets/ /server/.

# Gotta remove this Windows carriage return shenanigans
WORKDIR /server
RUN sed -i "s/\r//" .screepsrc

FROM node:${NODE_VERSION}-alpine as server
# hadolint ignore=DL3018
RUN --mount=type=cache,target=/var/cache/apk \
  apk add --no-cache git

COPY --from=screeps --chown=node /server /server/
RUN mkdir /screeps && chown node /screeps

USER node
WORKDIR /server

COPY screeps-cli.js ./bin/cli
COPY screeps-start.js ./bin/start
ENV PATH="/server/bin:${PATH}"

# Init mods package
WORKDIR /server/mods
RUN npm init -y

# Move the database file to shared directory
WORKDIR /data
RUN mv /server/db.json /data/db.json && \
  sed -i "s/db.json/\/data\/db.json/" /server/.screepsrc

RUN ln -s /screeps/config.yml /server/config.yml

ENV SERVER_DIR=/server NODE_ENV=production
WORKDIR /server
VOLUME [ "/screeps", "/data" ]
EXPOSE 21025
ENTRYPOINT ["start"]
