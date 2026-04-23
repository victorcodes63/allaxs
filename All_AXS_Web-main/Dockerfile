# Base multi-stage Dockerfile for Next.js (production)

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install dependencies only (use npm ci for clean, reproducible installs)
FROM base AS deps
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build the app
FROM base AS builder
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image — minimal runtime using Next.js standalone output
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S all_axs_dev && adduser -S all_axs_dev -G all_axs_dev

# Copy the standalone output and static assets
COPY --from=builder --chown=all_axs_dev:all_axs_dev /app/.next/standalone ./
COPY --from=builder --chown=all_axs_dev:all_axs_dev /app/.next/static ./.next/static
COPY --from=builder --chown=all_axs_dev:all_axs_dev /app/public ./public

USER all_axs_dev
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["node", "server.js"]


