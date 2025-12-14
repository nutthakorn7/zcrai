FROM oven/bun:1
WORKDIR /app

# Install dependencies (cached)
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Environment
ENV NODE_ENV=production
ENV PORT=8000

# Metadata
EXPOSE 8000

# Start
CMD ["bun", "run", "index.ts"]
