FROM node:20-alpine AS base

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Ensure persistent storage data directory exists
RUN mkdir -p /app/data

# Volume for persistent database storage
VOLUME ["/app/data"]

CMD ["npm", "start"]
