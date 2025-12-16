module.exports = {
  apps: [{
    name: "zcrai-api",
    script: "index.ts",
    interpreter: "/root/.bun/bin/bun",
    env: {
      NODE_ENV: "production"
    }
  }]
}
