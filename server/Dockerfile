FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# docker-compose overrides `command:` to run src/worker.js for the worker service.
CMD ["node", "src/server.js"]
