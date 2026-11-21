# Multi-stage Dockerfile using Debian-based Node.js 22 LTS (glibc-compatible for Temporal SDK)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source code
COPY src ./src

# Compile TypeScript
RUN npm run build

# Prune devDependencies for lean production image
RUN npm prune --omit=dev

# Stage 2: Minimal Production Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built output from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY public ./public

# Security: Run as unprivileged node user
USER node

EXPOSE 3000

# Default command runs the API server (worker container overrides this command)
CMD ["node", "dist/server.js"]
