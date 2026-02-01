FROM node:18

WORKDIR /app

# Copy package files
COPY package.json ./

# Install ONLY dependencies needed for the server
RUN npm install express cors stripe dotenv

# Copy server code
COPY server.js .

# Expose Hugging Face default port
EXPOSE 7860

# Run the server
CMD ["node", "server.js"]
