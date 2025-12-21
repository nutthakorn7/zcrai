module.exports = {
  apps: [{
    name: "zcrAI-backend",
    script: "/usr/bin/bun",
    args: ["run", "index.ts"],
    cwd: "/root/zcrAI/backend/api",
    exec_mode: "fork",
    exec_interpreter: "none",
    env: {
      NODE_ENV: "production",
      ENCRYPTION_KEY: "12345678901234567890123456789012",
      REDIS_URL: "redis://:redis_password@localhost:6379"
    }
  }]
}
