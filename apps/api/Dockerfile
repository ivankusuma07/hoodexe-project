# apps/api image for Railway: the API and the worker run from it (docs/DEPLOY.md).
# Build context is the repo root, for the pnpm workspace and packages/shared:
#   docker build -f apps/api/Dockerfile -t hood-api .
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable

WORKDIR /repo
# Manifests first, so source edits don't reinstall dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@hood/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api

ENV NODE_ENV=production
WORKDIR /repo/apps/api
USER node
EXPOSE 8787
# Railway sets PORT. HOOD_PROCESS=worker runs the worker from the same image (or railway.worker.json's command).
ENV HOOD_PROCESS=index
CMD ["sh", "-c", "exec node_modules/.bin/tsx src/$HOOD_PROCESS.ts"]
