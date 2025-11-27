FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ git git-lfs

COPY package*.json ./
COPY turbo.json ./

COPY packages ./packages
COPY apps/agent ./apps/agent

RUN git lfs install && git lfs pull || true

RUN npm ci --legacy-peer-deps

RUN npm run build

WORKDIR /app/apps/agent
RUN npm run build:server
RUN npm run build:web

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/agent/dist ./apps/agent/dist
COPY --from=builder /app/apps/agent/package.json ./apps/agent/
COPY --from=builder /app/apps/agent/drizzle ./apps/agent/drizzle

COPY --from=builder /app/packages/plugin-bias-lens/src/data ./packages/plugin-bias-lens/src/data

WORKDIR /app/apps/agent

RUN mkdir -p /app/data

ENV PORT=9200
EXPOSE 9200

COPY apps/agent/docker-entrypoint.sh /app/apps/agent/
RUN chmod +x /app/apps/agent/docker-entrypoint.sh

CMD ["/app/apps/agent/docker-entrypoint.sh"]
