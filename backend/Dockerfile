FROM node:20-alpine

# docker CLI for Docker image uploads
# python3 + make + g++ are required to compile better-sqlite3 native bindings
RUN apk add --no-cache docker-cli python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src ./src

RUN mkdir -p /tmp/nexus-pusher-uploads /app/data

EXPOSE 3001
CMD ["node", "src/index.js"]
