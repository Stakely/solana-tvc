# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl ca-certificates bzip2 xz-utils \
    libssl3 libudev1 libc6 \
    tini \
    git openssh-client \
  && rm -rf /var/lib/apt/lists/*

RUN sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"
RUN ln -sf /root/.local/share/solana/install/active_release/bin/solana /usr/local/bin/solana \
 && solana --version

# ---------------- deps ----------------
FROM base AS deps
WORKDIR /app

COPY package.json yarn.lock ./

# ---------------- builder ----------------
FROM base AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# ---------------- runner ----------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY docker/solana-updater.sh /usr/local/bin/solana-updater
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/solana-updater /usr/local/bin/entrypoint

EXPOSE 3000
ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint"]
