# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker cache for dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm install

# Copy the source code
COPY src ./src

# Build the TypeScript code to JavaScript (outputs to /dist based on tsconfig)
RUN npx tsc

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Copy package files again
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the compiled code from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
