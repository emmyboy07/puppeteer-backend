# Start from Puppeteer base image
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Install dependencies and set up the environment
RUN mkdir -p /var/lib/apt/lists/partial

# Add Google's GPG key to solve the key issue
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | tee /etc/apt/trusted.gpg.d/google.asc

# Clean up apt list and update repositories
RUN rm -rf /var/lib/apt/lists/* && apt-get update

# Install necessary dependencies (ensure apt sources are configured correctly)
RUN apt-get install -y \
  curl \
  gnupg2 \
  ca-certificates \
  apt-transport-https \
  lsb-release

# Install Google Chrome
RUN curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o google-chrome-stable_current_amd64.deb && \
  apt-get install -y ./google-chrome-stable_current_amd64.deb && \
  rm google-chrome-stable_current_amd64.deb

# Set up your working directory
WORKDIR /app

# Copy the rest of the files (adjust as necessary)
COPY . .

# Install necessary packages (assuming you are using Node.js)
RUN npm install

# Expose necessary ports
EXPOSE 3000

# Start your app (adjust according to your app's start command)
CMD ["npm", "start"]
