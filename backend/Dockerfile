FROM node:20-alpine

# Install Chromium for PDF export
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy dependency manifests first (cache optimization)
COPY package*.json ./

# Install production dependencies only.
# `npm ci` is ideal when the lockfile is perfectly reproducible, but the current
# dependency tree includes optional peer resolution that breaks clean installs in
# the container. `npm install` keeps the image build reliable for ECS deploys.
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY src/ ./src/

# Use non-root user (security best practice)
USER node

# Expose the port Express listens on
EXPOSE 5000

# Start the server
CMD ["node", "src/index.js"]
