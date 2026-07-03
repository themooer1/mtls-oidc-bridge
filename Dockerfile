FROM oven/bun:1.3-slim AS setup

# Read-only app source directory
WORKDIR /app

COPY src ./src
COPY bun.lock ./
COPY package.json ./
COPY tsconfig.json ./

RUN bun install


FROM oven/bun:1.3-distroless AS app

COPY --from=setup /app /app

# Read-write app working directory with config etc.
WORKDIR /config

ENTRYPOINT [ "bun", "run", "/app/src/main.ts" ]
