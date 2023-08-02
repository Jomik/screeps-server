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
RUN apk add --no-cache python2 make gcc g++

# Install screeps
WORKDIR /server
RUN npm install --save-exact "screeps@${SCREEPS_VERSION}" "js-yaml@4.1.0"

# Initialize screeps, similar to `screeps init`
WORKDIR /server/node_modules/@screeps/launcher/init_dist
RUN cp -a .screepsrc db.json assets/ /server/.

# Gotta remove this Windows carriage return shenanigans
WORKDIR /server
RUN sed -i "s/\r//" .screepsrc

FROM node:${NODE_VERSION}-alpine as server
# hadolint ignore=DL3018
RUN apk add --no-cache git

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
WORKDIR /screeps/data
RUN mv /server/db.json ./ && \
  sed -i "s/db.json/\/screeps\/data\/db.json/" /server/.screepsrc

ENV SERVER_DIR=/server CONFIG=/screeps/config.yml NODE_ENV=production
WORKDIR /server
VOLUME [ "/screeps" ]
EXPOSE 21025
ENTRYPOINT ["start"]
