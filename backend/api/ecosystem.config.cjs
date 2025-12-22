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
      ENCRYPTION_KEY: "zcrAI_32char_encryption_key_2024",
      REDIS_URL: "redis://:redis_password@localhost:6379",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zcrai",
      JWT_SECRET: "zcrAI_super_secure_jwt_secret_2024_production_key",
      COLLECTOR_API_KEY: "zcrAI_super_secure_collector_key_2024",
      COLLECTOR_URL: "http://localhost:8001"
    }
  }]
}
