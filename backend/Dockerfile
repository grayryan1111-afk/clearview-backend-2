FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install
COPY . .
RUN mkdir -p /app/data /app/uploads
EXPOSE 8080
CMD ["npm", "start"]
