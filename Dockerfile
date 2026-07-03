FROM node:20-alpine
WORKDIR /app

COPY package.json server.js index.html app.js styles.css config.json ./
COPY data.json ./data.json

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/app/data/data.json

RUN mkdir -p /app/data && cp data.json /app/data/data.json

EXPOSE 3000
CMD ["node", "server.js"]
