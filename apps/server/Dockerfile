# Build from the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci --workspace @zynk/server --workspace @zynk/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @zynk/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
