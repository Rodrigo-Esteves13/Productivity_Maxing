FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# O Vite "cozinha" as variáveis VITE_* dentro do bundle no momento do build -
# ao contrário do backend, isto NÃO pode vir de uma env var passada em
# runtime ao container (nessa altura já é tarde, o JS já está compilado).
# Por isso entra como build arg, definido no docker-compose.yml em
# services.frontend.build.args.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
