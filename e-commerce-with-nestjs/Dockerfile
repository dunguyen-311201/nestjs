ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /usr/src/app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_NAME=api-gateway
COPY . .
RUN npx nest build ${APP_NAME}
RUN pnpm install --prod --frozen-lockfile

FROM node:${NODE_VERSION} AS production
ARG APP_NAME=api-gateway
ENV APP_NAME=${APP_NAME} \
    NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
