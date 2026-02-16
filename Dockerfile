FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY --from=build /app/dist ./dist

ENV PORT=10000
EXPOSE 10000

CMD ["bun", "run", "src/server/index.ts"]
