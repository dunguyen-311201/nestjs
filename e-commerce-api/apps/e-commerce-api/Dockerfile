# 1. Base Stage: Setup pnpm
ARG NODE_VERSION=24.13.0
FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

# 2. Pruner Stage
FROM base AS pruner
RUN pnpm add -g turbo
COPY . .
RUN turbo prune e-commerce-api --docker

# 3. Builder Stage: Install and Build
FROM base AS builder
COPY --from=pruner /usr/src/app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /usr/src/app/out/full/ .
RUN pnpm turbo run build --filter=e-commerce-api

# 4. Runner Stage: Final Image
FROM base AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PATH="/usr/src/app/node_modules/.bin:$PATH"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

COPY --from=builder /usr/src/app/apps/e-commerce-api/build ./apps/e-commerce-api/build
COPY --from=builder /usr/src/app/apps/e-commerce-api/src/adapters/mail/templates ./apps/e-commerce-api/build/adapters/mail/templates
COPY --from=builder /usr/src/app/apps/e-commerce-api/node_modules ./apps/e-commerce-api/node_modules
COPY --from=builder /usr/src/app/apps/e-commerce-api/package.json ./apps/e-commerce-api/package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

RUN chown -R fastify:nodejs /usr/src/app

USER fastify
EXPOSE 8080

WORKDIR /usr/src/app/apps/e-commerce-api
CMD ["node", "--conditions=production", "--import", "tsx", "build/server.js"]
