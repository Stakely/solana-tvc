# syntax=docker/dockerfile:1.7

FROM node:26-trixie-slim AS base

ENV CI=true

ARG RPC_URLS
ENV RPC_URLS=$RPC_URLS

ARG EPOCH_FILE_TTL
ENV EPOCH_FILE_TTL=$EPOCH_FILE_TTL

ARG SNAPSHOT_FILE_TTL
ENV SNAPSHOT_FILE_TTL=$SNAPSHOT_FILE_TTL

ARG VALIDATOR_INFO_FILE_TTL
ENV VALIDATOR_INFO_FILE_TTL=$VALIDATOR_INFO_FILE_TTL

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl ca-certificates bzip2 xz-utils \
    libssl3t64 libudev1 libc6 \
    tini \
    git openssh-client \
  && rm -rf /var/lib/apt/lists/*

# Pinned: the snapshot parser depends on the CLI's JSON output (spec §6.1).
ARG SOLANA_VERSION=4.3.2
RUN sh -c "$(curl -sSfL https://release.anza.xyz/v${SOLANA_VERSION}/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

RUN ln -sf /root/.local/share/solana/install/active_release/bin/solana /usr/local/bin/solana \
 && solana --version

# Node 25+ no longer ships corepack, so pnpm is installed with npm. Keep the
# version in sync with packageManager in package.json.
RUN npm install -g pnpm@11.1.2 \
  && pnpm --version
# ---------------- deps ----------------
FROM base AS deps
WORKDIR /app

# pnpm-workspace.yaml carries the quarantine window and the allowBuilds
# verdicts, so it has to be there before the install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

# ---------------- builder ----------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ---------------- runner ----------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PUBLIC_DIR=/app/public
ENV SNAPSHOT_FILE_TTL=5000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY docker/entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint \
 && mkdir -p /app/public

EXPOSE 3000

ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint"]