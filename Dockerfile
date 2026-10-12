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
  && apt-get upgrade -y \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system pindash \
  && useradd --system --gid pindash --home-dir /app pindash \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

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

FROM runtime AS coolify

ARG PINDASH_SERVICE=api
ENV PINDASH_SERVICE=$PINDASH_SERVICE
ENV PORT=4000

RUN case "$PINDASH_SERVICE" in     api|worker) ;;     *) echo "PINDASH_SERVICE must be api or worker" >&2; exit 1 ;;   esac

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3   CMD if [ "$PINDASH_SERVICE" = "worker" ]; then exit 0; else node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/v1/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"; fi

CMD ["sh", "-c", "exec node apps/$PINDASH_SERVICE/dist/main.js"]
