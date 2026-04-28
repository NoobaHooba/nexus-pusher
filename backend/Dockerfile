ARG INSTALL_MODE=online

FROM node:20-alpine AS backend-online-base
WORKDIR /app
RUN apk add --no-cache python3 make g++

FROM node:20-bookworm-slim AS backend-offline-base
ARG APT_MIRROR="http://deb.debian.org/debian"
ARG APT_SECURITY_MIRROR="http://deb.debian.org/debian-security"
WORKDIR /app

# python3 + make + g++ are required when npm installs or rebuilds native
# modules such as better-sqlite3.
RUN sed -i "s|URIs: http://deb.debian.org/debian|URIs: ${APT_MIRROR}|g; s|URIs: http://deb.debian.org/debian-security|URIs: ${APT_SECURITY_MIRROR}|g" /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

FROM backend-online-base AS backend-deps-online
COPY package.json ./
RUN npm install --production

FROM backend-offline-base AS backend-deps-offline
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
RUN rm -rf ./node_modules/better-sqlite3/build \
 && cd ./node_modules/better-sqlite3 \
 && node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild --release

FROM backend-deps-${INSTALL_MODE} AS runtime
COPY src ./src

RUN mkdir -p /tmp/nexus-pusher-uploads /app/data \
 && chgrp -R 0 /app /tmp/nexus-pusher-uploads \
 && chmod -R g=u /app /tmp/nexus-pusher-uploads

EXPOSE 3001
CMD ["node", "src/index.js"]
