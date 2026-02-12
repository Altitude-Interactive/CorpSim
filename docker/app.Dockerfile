FROM node:20-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SHIPMENT_BASE_FEE_CENTS
ARG NEXT_PUBLIC_SHIPMENT_FEE_PER_UNIT_CENTS

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SHIPMENT_BASE_FEE_CENTS=${NEXT_PUBLIC_SHIPMENT_BASE_FEE_CENTS}
ENV NEXT_PUBLIC_SHIPMENT_FEE_PER_UNIT_CENTS=${NEXT_PUBLIC_SHIPMENT_FEE_PER_UNIT_CENTS}

RUN pnpm install --frozen-lockfile
RUN pnpm -C packages/db generate
RUN pnpm -C apps/web build
