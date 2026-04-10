FROM node:20-alpine

# Install docker CLI for Docker image uploads
RUN apk add --no-cache docker-cli

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src ./src

RUN mkdir -p /tmp/nexus-pusher-uploads

EXPOSE 3001
CMD ["node", "src/index.js"]
