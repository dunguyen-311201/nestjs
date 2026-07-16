FROM node:22-alpine AS base
RUN npm install -g pnpm

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json tsconfig.build.json ./
COPY libs ./libs

FROM base AS builder
ARG APP_NAME
COPY apps/${APP_NAME} ./apps/${APP_NAME}
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN npx nest build ${APP_NAME}

FROM node:22-alpine AS runner
WORKDIR /usr/src/app
ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /usr/src/app/dist/apps/${APP_NAME} ./dist/apps/${APP_NAME}

USER node

CMD node dist/apps/${APP_NAME}/main.js
