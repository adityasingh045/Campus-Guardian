FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Vite reads VITE_* env vars at build time
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
ARG VITE_API_KEY

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_KEY=$VITE_API_KEY

RUN npm run build


FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 5173

CMD ["npm", "run", "preview"]
