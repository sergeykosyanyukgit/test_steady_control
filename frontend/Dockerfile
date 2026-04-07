FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY babel.config.js ./
COPY vue.config.js ./
RUN npm install

COPY public ./public
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["npm", "start"]
