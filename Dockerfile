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

# Volume for persistent database
VOLUME ["/app/data"]

CMD ["npm", "start"]
