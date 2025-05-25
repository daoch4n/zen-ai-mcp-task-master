# Use a suitable Node.js base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Add ARG instructions for OpenAI API keys
ARG OPENAI_API_KEY
ARG OPENAI_API_BASE_URL
ARG TASKMASTER_AI_MODEL
ARG TASKMASTER_RESEARCH_MODEL

# Set them as ENV variables
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV OPENAI_API_BASE_URL=$OPENAI_API_BASE_URL
ENV TASKMASTER_AI_MODEL="gemini-2.5-flash-preview-05-20"
ENV TASKMASTER_RESEARCH_MODEL="gemini-2.5-flash-preview-05-20"

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
CMD ["node", "mcp-server/server.js"]