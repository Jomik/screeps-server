#!/bin/bash

source .env

if [ -z "$SERVER_HOSTNAME" ]; then
  echo 'Set SERVER_HOSTNAME in .env to the name this certificate should use.' >&2
  exit 1
fi

openssl req -x509 -newkey rsa:2048 -sha256 -days 2 -nodes \
  -keyout $SERVER_HOSTNAME.key \
  -out $SERVER_HOSTNAME.crt \
  -subj "/CN=$SERVER_HOSTNAME" \
  -addext "subjectAltName=DNS:$SERVER_HOSTNAME" \
  -addext "basicConstraints=critical,CA:TRUE"

docker compose --profile https stop letsencrypt-companion
docker compose --profile https up -d screeps nginx
docker compose --profile https cp $SERVER_HOSTNAME.crt nginx:/etc/nginx/certs/$SERVER_HOSTNAME.crt
docker compose --profile https cp $SERVER_HOSTNAME.key nginx:/etc/nginx/certs/$SERVER_HOSTNAME.key
