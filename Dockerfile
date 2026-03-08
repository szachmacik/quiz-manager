# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install ALL dependencies (including devDependencies needed for build)
# Force development mode to ensure devDependencies are installed
ENV NODE_ENV=development
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the application (vite build + esbuild server)
RUN pnpm run build

# ─── Production Stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install production dependencies only
ENV NODE_ENV=production
RUN pnpm install --no-frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start the server (esbuild outputs to dist/index.js)
CMD ["node", "dist/index.js"]
