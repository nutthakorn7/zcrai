module.exports = {
  apps: [{
    name: "zcrAI-backend",
    script: "index.ts",
    interpreter: "/usr/bin/bun",
    interpreterArgs: "run",
    cwd: "/root/zcrAI/backend/api",
    env_file: "/root/zcrAI/backend/api/.env",
    env: {
      NODE_ENV: "production",
      ENCRYPTION_KEY: "12345678901234567890123456789012",
      REDIS_URL: "redis://:redis_password@localhost:6379"
    }
  }]
}
