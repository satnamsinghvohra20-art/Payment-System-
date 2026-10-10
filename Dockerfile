# Production Multi-Stage Dockerfile for SplitPay Enterprise
FROM node:24-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies (only production)
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create volume mount directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/info || exit 1

CMD ["node", "server.js"]
