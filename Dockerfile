# Multi-stage build to keep runtime small
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install OS deps for Prisma and bcrypt
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates libc6-dev python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install prod deps (keep dev only for prisma generate)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Prepare runtime image
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy node_modules and generated prisma client from build stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/generated ./generated
COPY --from=base /app ./

# Create uploads directory (mounted as volume in deploy)
RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "server.js"]
