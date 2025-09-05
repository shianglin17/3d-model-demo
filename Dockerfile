FROM node:20-alpine AS base
WORKDIR /usr/src/app

# 安裝依賴
COPY package.json package-lock.json* ./
RUN npm install

# 共同檔案
COPY . .

# 開發階段（nodemon）
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm","run","dev"]

# 正式階段（node server.js）
FROM base AS prod
ENV NODE_ENV=production
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["npm","run","start"]
