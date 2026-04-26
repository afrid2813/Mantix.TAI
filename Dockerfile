FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build React/Vite app
COPY . .
RUN npm run build

# Production image
FROM node:22-alpine
WORKDIR /app

# Copy built app and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services

# If the routes/services were strictly TypeScript and needed running, tsx is available in node_modules,
# but we can also use native Node 22 type stripping.

# Set Node environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start server
CMD ["node", "--experimental-strip-types", "server.ts"]
