FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY babel.config.js ./
COPY vue.config.js ./
RUN npm install

COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./dist

RUN rm -rf /usr/share/nginx/html/* && cp -r /dist/* /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
