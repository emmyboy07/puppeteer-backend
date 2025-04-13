FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Install additional dependencies required for Puppeteer to run headless
RUN apt-get update && apt-get install -y \
  libx11-dev \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libxi6 \
  libgdk-pixbuf2.0-0 \
  libgconf-2-4 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libpango-1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libxss1 \
  libasound2 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libnspr4 \
  lsb-release \
  xdg-utils

# Check Google Chrome version
RUN google-chrome-stable --version

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Run the application
CMD ["node", "index.js"]
