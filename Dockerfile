# ── Build stage ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime stage ──────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js ./
COPY public/   ./public/

# db.json is created at runtime — mount a volume to persist it:
# docker run -v $(pwd)/data:/app/data ...
# and set DB_FILE=/app/data/db.json in env, or just accept it resets on redeploy
ENV NODE_ENV=production \
    PORT=8899

EXPOSE 8899

# Run as non-root for security
USER node

CMD ["node", "server.js"]
