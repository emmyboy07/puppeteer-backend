# Use the official Puppeteer image as the base
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Switch to root user to avoid permission issues during apt-get
USER root

# Set environment variables to skip Chromium download and use the stable version of Google Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Create the necessary directories for apt-get
RUN mkdir -p /var/lib/apt/lists/partial

# Clean up apt list and update repositories
RUN rm -rf /var/lib/apt/lists/* && apt-get update

# Install necessary dependencies (ensure apt sources are configured correctly)
RUN apt-get install -y \
    wget \
    curl \
    gnupg2 \
    ca-certificates \
    unzip \
    && apt-get clean

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if present) to the working directory
COPY package*.json ./

# Install dependencies with npm
RUN npm ci

# Copy all the files to the working directory
COPY . .

# Expose the port that the app will run on (default to 10000 in your code)
EXPOSE 10000

# Run the Node.js application
CMD ["node", "index.js"]
