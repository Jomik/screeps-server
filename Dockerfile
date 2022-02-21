FROM node:12-alpine

# Install 
RUN apk add --no-cache --virtual .build-deps python2 make gcc g++

USER node
WORKDIR /server
ENV NODE_ENV=production
RUN npm init -y
RUN npm install --save-exact screeps

USER root
RUN apk del .build-deps

# Init
USER node
RUN cd ./node_modules/@screeps/launcher/init_dist && \
  cp -a .screepsrc db.json node_modules/ mods.json /server/.
RUN chmod +x ./node_modules/.hooks/install ./node_modules/.hooks/uninstall

# Gotta remove this Windows carriage return shenanigans
RUN sed -i "s/\r//" .screepsrc ./node_modules/.hooks/install ./node_modules/.hooks/uninstall

# Install custom mods
ARG NPM_MODS
RUN test -z "${NPM_MODS}" || npm install -E ${NPM_MODS}

# Install local mods
COPY ./mods ./mods

EXPOSE 21025
ENTRYPOINT [ "node", "/server/node_modules/.bin/screeps" ,"start", "--steam_api_key", "${STEAM_KEY}" ]
