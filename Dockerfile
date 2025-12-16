# Use Node.js 18 LTS
FROM node:18-slim

# Install build dependencies for sqlite3
RUN apt-get update && apt-get install -y \
    libatomic1 \
    python3 \
    make \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci to avoid lockfile issues)
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

