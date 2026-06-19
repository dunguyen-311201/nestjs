ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /usr/src/app
# Install pnpm
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_NAME=api-gateway
COPY . .
RUN npx nest build ${APP_NAME}
# Only install production dependencies for smaller image size
RUN pnpm install --prod --frozen-lockfile

FROM node:${NODE_VERSION} AS production
ARG APP_NAME=api-gateway
ENV APP_NAME=${APP_NAME} \
    NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

WORKDIR /usr/src/app

COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
