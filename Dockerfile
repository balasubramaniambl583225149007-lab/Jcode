# Multi-stage Dockerfile for jcode Platform
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy root and client dependency specifications
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy full source
COPY . .

# Build client distribution
RUN cd client && npm run build

# --- Production Stage ---
FROM node:20-bookworm-slim

WORKDIR /app

# Install runtime utilities: Python3 (for PTY & HTTP servers), Git, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    git \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy built application and production dependencies
COPY --from=builder /app /app

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV APP_PASSWORD=jcode123

# Ensure CLI agent executable permissions
RUN chmod +x /app/bin/jcode /app/server/pty/pty-bridge.py

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth/me || exit 1

CMD ["node", "server/server.js"]
