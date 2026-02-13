FROM node:16-alpine AS base

######## Prepare package.json and pnpm-lock.yaml
FROM base AS package

COPY package.json package-lock.json ./
RUN npm version --allow-same-version 1.0.0

######## Preperation
FROM node:14-alpine AS deps

COPY --from=package package.json package-lock.json ./
RUN npm install

######## Building
FROM base AS build

WORKDIR /app

COPY --from=deps node_modules ./node_modules

COPY . .
ARG MONGO_MAIN
ARG FIREBASE_WEB_CONFIG
RUN npm run build-ts
RUN MONGO_MAIN=$MONGO_MAIN FIREBASE_WEB_CONFIG=$FIREBASE_WEB_CONFIG npm run next:build

#### Prune cache files
RUN rm -rf ./next/build/.next/cache

## prune devDependencies
RUN npm prune --omit=dev

######## Deploy
FROM base AS deploy

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/next/public ./next/public
COPY --from=build /app/next/.next ./next/.next
COPY --from=build /app/next/next.config.js ./next/next.config.js
COPY --from=build /app/config ./config
COPY package.json package-lock.json ./

EXPOSE 5555

CMD [ "npm", "start"]