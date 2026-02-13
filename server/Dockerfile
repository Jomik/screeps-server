ARG NODE_VERSION=10
FROM node:${NODE_VERSION}-slim AS screeps

ENV DEBIAN_FRONTEND=noninteractive

# Because Stretch is oldoldstable, it's in the archive now
RUN sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list \
 && sed -i 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list \
 && sed -i '/stretch-updates/d' /etc/apt/sources.list
RUN apt-get update

# Install node-gyp dependencies
# We do not pin as we use multiple node versions.
# They are so old that there is no changes to their package registry anyway..
# hadolint ignore=DL3018
RUN apt-get install -y bash python make gcc g++ git

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

FROM node:${NODE_VERSION}-slim AS server

ENV DEBIAN_FRONTEND=noninteractive

# Because Stretch is oldoldstable, it's in the archive now
RUN sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list \
 && sed -i 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list \
 && sed -i '/stretch-updates/d' /etc/apt/sources.list
RUN apt-get update

RUN apt-get install -y git wget

USER node
COPY --from=screeps --chown=node:node /screeps /screeps/

# Move the database file to shared directory
WORKDIR /data
RUN mv /screeps/db.json /data/db.json && \
  sed -i "s/db = db.json/db = \/data\/db.json/" /screeps/.screepsrc
RUN mv /screeps/assets /data/assets && \
  sed -i "s/assetdir = assets/assetdir = \/data\/assets/" /screeps/.screepsrc

WORKDIR /screeps

# Init mods package
RUN mkdir ./mods && echo "{}" > ./mods/package.json

COPY screeps-cli.cjs ./bin/cli
COPY screeps-start.cjs ./bin/start

ENV SERVER_DIR=/screeps NODE_ENV=production PATH="/screeps/bin:${PATH}"

VOLUME [ "/data" ]
EXPOSE 21025

HEALTHCHECK --start-period=10s --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:21025/api/version || exit 1

ENTRYPOINT ["start"]
