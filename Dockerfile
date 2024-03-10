# Use Node.js version 20 Alpine image
FROM node:20-alpine

# Install Tini and cron
RUN apk update && apk add --no-cache dcron tini tzdata

# Set the timezone (optional)
ENV TZ=Asia/Jerusalem
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV NODE_ENV=production

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Set permissions for the entrypoint script
RUN chmod +x ./entrypoint.sh

# Use Tini and the entrypoint script
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]