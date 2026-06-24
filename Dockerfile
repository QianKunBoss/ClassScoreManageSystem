# ============================
# CSMS v0.3.0 - Multi-stage Docker Build
# Nuxt 3 + @libsql/client + Drizzle ORM
# No native C++ compilation needed!
# ============================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build Nuxt production output
RUN npm run build

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
# @libsql/client is pure JS (WASM) — no C++ build tools needed!
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output from builder
COPY --from=builder /app/.output .output

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Expose port
ENV HOST=::
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/settings || exit 1

# Start Nuxt server
CMD ["node", ".output/server/index.mjs"]
