# 1. Base Stage: Setup pnpm
ARG NODE_VERSION=24.13.0
FROM node:${NODE_VERSION}-alpine as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

# 2. Prune Stage: Isolate the web app
FROM base AS pruner
RUN pnpm add -g turbo
COPY . .
RUN turbo prune web --docker

# 3. Builder Stage: Install and Build
FROM base AS builder
# Copy pruned package.json/lockfiles for optimized dependency caching
COPY --from=pruner /usr/src/app/out/json/ .
RUN --mount=type=cache,target=/pnpm/store \
 pnpm install --no-frozen-lockfile

# Copy full source and build
COPY --from=pruner /usr/src/app/out/full/ .
# Generate the .next/standalone folder
RUN pnpm turbo run build --filter=web

# 4. Runner Stage: Production
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /usr/src/app

# Next.js standalone mode requires specific folder copying:
# 1. The standalone folder includes a server.js and minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/web/.next/standalone ./
# 2. Static files (CSS/JS) must be copied manually to the expected path
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/web/.next/static ./apps/web/.next/static
# 3. Public assets (Images/Favicons)
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/web/public ./apps/web/public

EXPOSE 3000

# The entry point is the generated server.js inside the standalone folder
WORKDIR /usr/src/app
CMD ["node", "apps/web/server.js"]