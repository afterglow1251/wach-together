FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY src ./src
COPY --from=build /app/dist ./dist

ENV PORT=10000
EXPOSE 10000

CMD ["bun", "run", "src/server/index.ts"]
