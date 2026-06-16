FROM node:20-alpine

ENV TZ=America/Argentina/Buenos_Aires

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "./bin/www"]
