 
# backend/Dockerfile
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
 
COPY package*.json ./
RUN npm ci
 
COPY . .
RUN npx prisma generate
RUN npm run build
 
FROM node:20
WORKDIR /app
ENV NODE_ENV=production
 
COPY package*.json ./
RUN npm ci --omit=dev
 
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
 
EXPOSE 3000
CMD ["node", "dist/main"]
 
 
