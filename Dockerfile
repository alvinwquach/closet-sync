# Use the official Node.js 20 slim image as the base image
FROM node:20-slim AS base

# Create a builder stage from the base image
FROM base AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if it exists) to the working directory
COPY package.json package-lock.json* ./

# Install the dependencies defined in package.json
RUN npm ci

# Copy the rest of the application files to the working directory
COPY . .

# Disable Next.js telemetry for this build
ENV NEXT_TELEMETRY_DISABLED=1

# Set the Node.js environment to production
ENV NODE_ENV=production

# Define build-time variables
ARG TABLE_NAME
ARG RECAPTCHA_SECRET
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_PLANNER_ID
ARG MAILING_LIST_ENDPOINT
ARG MAILING_LIST_PASSWORD

# Build the Next.js application
RUN npm run build

# Create a final image stage from the base image
FROM base AS runner

# Set the working directory again for the runner stage
WORKDIR /app

# Disable Next.js telemetry and set the environment to production again
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Create a system group and user for running the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public directory from the builder stage
COPY --from=builder /app/public ./public

# Create the .next directory for the built application
RUN mkdir .next

# Change ownership of the .next directory to the nextjs user
RUN chown nextjs:nodejs .next

# Copy the standalone build and static assets from the builder stage,
# setting the owner to nextjs user and nodejs group
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the nextjs user to run the application with limited privileges
USER nextjs

# Expose port 3000 for the application to listen on
EXPOSE 3000

# Set the PORT environment variable for the application
ENV PORT=3000