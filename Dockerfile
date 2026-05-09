FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY register.js ./

ENV NODE_ENV=production
ENV UPKEEP_DB_PATH=/data/upkeep.db

CMD ["node", "src/index.js"]
