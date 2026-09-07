FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json next.config.js csp.js redirects.js ./

# Uploads live here. Mount a volume over it in production: a container
# filesystem does not survive a redeploy, and neither would the media.
ENV MEDIA_DIR=/app/media
RUN mkdir -p /app/media && chown -R node:node /app/media
VOLUME ["/app/media"]

EXPOSE 3000
USER node
CMD ["npx", "next", "start"]
