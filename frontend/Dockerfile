# # Base image
# FROM node:18-alpine

# # Set workdir
# WORKDIR /app

# # Install dependencies
# COPY package*.json ./
# RUN npm install

# ARG REACT_APP_API_BASE
# ENV REACT_APP_API_BASE=${REACT_APP_API_BASE}

# # Copy source code
# COPY . .

# # Build React app
# RUN npm run build

# # Install serve for production
# RUN npm install -g serve

# # Expose port
# EXPOSE 3006

# # Start the app
# CMD ["serve", "-s", "build", "-l", "3000"]

# ---------- build stage ----------
FROM node:18-alpine AS build
WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci

# env masuk saat build (React baca env di build-time)
ARG REACT_APP_API_BASE
ENV REACT_APP_API_BASE=${REACT_APP_API_BASE}

# source
COPY . .
# build (PostCSS + Tailwind jalan karena devDeps ada di stage ini)
RUN npm run build

# ---------- runtime stage ----------
FROM node:18-alpine
WORKDIR /app
RUN npm i -g serve
COPY --from=build /app/build ./build

# konsisten: kita pakai 3006 di host, serve dengar di 3000 lalu di-map di compose
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
