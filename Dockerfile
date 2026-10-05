FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/worker apps/worker
COPY packages/contracts packages/contracts
COPY packages/database packages/database

RUN npm run build -w @pindash/contracts \
  && npm run build -w @pindash/database \
  && npm run build -w @pindash/api \
  && npm run build -w @pindash/worker \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system pindash \
  && useradd --system --gid pindash --home-dir /app pindash

COPY --from=build --chown=pindash:pindash /app/package.json ./package.json
COPY --from=build --chown=pindash:pindash /app/node_modules ./node_modules
COPY --from=build --chown=pindash:pindash /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=pindash:pindash /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=pindash:pindash /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build --chown=pindash:pindash /app/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=pindash:pindash /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=pindash:pindash /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=pindash:pindash /app/packages/database/package.json ./packages/database/package.json
COPY --from=build --chown=pindash:pindash /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=pindash:pindash /app/packages/database/prisma ./packages/database/prisma

USER pindash

FROM runtime AS api
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM runtime AS worker
CMD ["node", "apps/worker/dist/main.js"]
