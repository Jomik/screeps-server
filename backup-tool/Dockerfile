# Orchestrates backup/restore using the host Docker socket. Mount the repo at the same path
# as on the host (compose file already maps .:/workspace when using profile tools).
FROM docker:27-cli
RUN apk add --no-cache nodejs
WORKDIR /app
COPY package.json /app/
COPY src/database.js /app/src/database.js
RUN chmod +x /app/src/database.js
ENTRYPOINT ["node", "/app/src/database.js"]
