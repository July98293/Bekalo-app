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

ENV NODE_ENV=production \
    PORT=8899

# Give the node user write access to /app so db.json can be created at runtime
RUN chown -R node:node /app

EXPOSE 8899

# Run as non-root for security
USER node

CMD ["node", "server.js"]
