#FROM node:18-alpine
#WORKDIR /app
#COPY package*.json ./
#RUN npm install
#COPY . .
#RUN npm run build
#EXPOSE 3000
#CMD ["npx","serve", "-s", "build"]

FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

RUN npm install -g serve
#CMD ["serve", "-s", "build", "-l", "3000"]
CMD ["serve", "-s", "build", "-l", "tcp://0.0.0.0:3000"]

