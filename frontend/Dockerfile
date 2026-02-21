FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_URL is not needed - we proxy via nginx
RUN npm run build

FROM nginx:alpine AS runner
RUN apk add --no-cache bash
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
# nginx official image runs envsubst automatically for files in /etc/nginx/templates/
CMD ["nginx", "-g", "daemon off;"]
