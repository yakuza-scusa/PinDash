FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/database packages/database
RUN npm run build -w @pindash/contracts && npm run build -w @pindash/database && npm run build -w @pindash/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S pindash && adduser -S pindash -G pindash
COPY --from=build --chown=pindash:pindash /app/node_modules ./node_modules
COPY --from=build --chown=pindash:pindash /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=pindash:pindash /app/packages/database/prisma ./packages/database/prisma
USER pindash
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
