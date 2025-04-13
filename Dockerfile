# Use the official Puppeteer image as the base image
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Switch to root user to install dependencies
USER root

# Create necessary directories with root permissions
RUN mkdir -p /var/lib/apt/lists/partial

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the project files into the container
WORKDIR /app
COPY . .

# Install project dependencies (if any, assuming a Node.js app for Puppeteer)
RUN npm install

# Set the environment variable for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Expose the necessary port for the app (optional)
EXPOSE 3000

# Start the app (modify as needed based on your app)
CMD ["npm", "start"]
