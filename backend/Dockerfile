ARG INSTALL_MODE=online

FROM node:20-alpine AS backend-base
WORKDIR /app

FROM backend-base AS backend-online-base

# python3 + make + g++ are required when npm installs native modules such as
# better-sqlite3 during the connected build. The offline path reuses vendored
# node_modules and intentionally skips apk entirely.
RUN apk add --no-cache python3 make g++

FROM backend-online-base AS backend-deps-online
COPY package.json ./
RUN npm install --production

FROM backend-base AS backend-deps-offline
COPY package.json package-lock.json ./
COPY node_modules ./node_modules

FROM backend-deps-${INSTALL_MODE} AS runtime
COPY src ./src

RUN mkdir -p /tmp/nexus-pusher-uploads /app/data \
 && chgrp -R 0 /app /tmp/nexus-pusher-uploads \
 && chmod -R g=u /app /tmp/nexus-pusher-uploads

EXPOSE 3001
CMD ["node", "src/index.js"]
