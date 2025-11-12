# Backend Dockerfile for SmartAgro
# Uses a stable Node LTS image and installs only production dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --production

# Copy source
COPY . .

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# If you use native modules like sharp, ensure build deps; alpine may require musl compat.
# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Expose port (default via ENV.PORT)
EXPOSE 3000

CMD ["node", "src/server.js"]
