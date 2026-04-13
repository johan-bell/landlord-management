# syntax=docker/dockerfile:1
# Single image: tenant at /, admin at /admin/, platform at /platform/.
# Expects API behind the same origin at /api/ (see docker-compose).

FROM node:22-alpine AS tenant-build
WORKDIR /app
COPY tenant/package.json tenant/package-lock.json ./
RUN npm ci
COPY tenant/ ./
ENV VITE_API_URL=/api
RUN npx vue-tsc -b && npx vite build --base /

FROM node:22-alpine AS admin-build
WORKDIR /app
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
ENV VITE_API_URL=/api
RUN npx vue-tsc -b && npx vite build --base /admin/

FROM node:22-alpine AS platform-build
WORKDIR /app
COPY platform/package.json platform/package-lock.json ./
RUN npm ci
COPY platform/ ./
ENV VITE_API_URL=/api
RUN npx vue-tsc -b && npx vite build --base /platform/

FROM nginx:alpine
COPY docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=tenant-build /app/dist /usr/share/nginx/html/tenant
COPY --from=admin-build /app/dist /usr/share/nginx/html/admin
COPY --from=platform-build /app/dist /usr/share/nginx/html/platform
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
