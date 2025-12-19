module.exports = {
  apps: [{
    name: "zcrAI-backend",
    script: "/usr/bin/bun",
    args: "run index.ts",
    cwd: "/root/zcrAI/backend/api",
    env: {
      NODE_ENV: "production"
    }
  }]
}
