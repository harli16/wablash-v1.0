# backend/Dockerfile
FROM node:18-bullseye-slim

WORKDIR /app

# Install Chromium + deps yang dibutuhkan Puppeteer/venom
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
 && rm -rf /var/lib/apt/lists/*

# Beritahu venom/puppeteer untuk pakai Chromium dari OS, bukan download Chrome
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install deps Node
COPY package*.json ./
RUN npm install --omit=dev
# RUN npm ci --only=production

# Copy source
COPY . .

# Siapkan folder tokens agar persistent (compose sudah mount volume ke /app/tokens)
RUN mkdir -p /app/tokens && chown -R node:node /app
USER node

EXPOSE 3001
CMD ["npm","start"]
