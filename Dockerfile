# Use a suitable Node.js base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# This allows caching of dependencies
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application files to the working directory
COPY . .

# Expose port 3000
EXPOSE 3000

# Define the command to start the application
# Based on the project structure, 'node index.js' is appropriate
CMD ["node", "index.js"]