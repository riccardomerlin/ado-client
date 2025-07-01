# Use official Node.js runtime as the base image
FROM node:20-alpine

# Set working directory in the container
WORKDIR /app

# Copy package.json (and package-lock.json if it exists)
COPY package*.json ./

# Install dependencies using npm install (not npm ci)
# This allows the build to work without package-lock.json
RUN npm install --production

# Copy the application code
COPY src/ ./src/
COPY apprunner.yaml ./

# Set the PORT environment variable for the container
ENV PORT=3000

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
