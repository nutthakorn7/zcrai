module.exports = {
  apps: [{
    name: "zcrAI-backend",
    script: "index.ts",
    interpreter: "bun", // Let PM2 resolve bun from PATH if possible, or use absolute /root/.bun/bin/bun
    env: {
      NODE_ENV: "production",
      // Force load .env from current directory to avoid missing vars
      DOTENV_CONFIG_PATH: "./.env"
    }
  }]
}
