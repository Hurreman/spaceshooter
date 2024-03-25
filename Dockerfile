# Build React App
FROM node:18-alpine as builder
WORKDIR /home/node/app
COPY . .
RUN npm ci
RUN npm run build 

# Copy dist folder and start the express server
FROM node:18-alpine as server
COPY --from=builder /home/node/app/dist /spaceshooter/dist
WORKDIR /spaceshooter/server

RUN npm install pm2@latest -g

# Install extra packages
RUN apk add htop
RUN apk add nano

COPY ./server .

RUN npm ci

RUN npx prisma generate

CMD pm2 start pm2.ecosystem.config.js && \
    pm2 logs
