# syntax=docker/dockerfile:1

# Debian slim (not alpine) -> fewer Prisma/openssl surprises.
# Node 24 satisfies @prisma/client engine ">=24.0". Build and run on the SAME
# base so Prisma's generated engine binary matches the runtime.
FROM node:24-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare yarn@1.22.22 --activate
WORKDIR /app

FROM base AS builder
COPY package.json yarn.lock ./
COPY prisma ./prisma
# postinstall runs `prisma generate` (no DB needed). Migrations run at deploy time.
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["yarn", "start"]
