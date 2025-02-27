module.exports = {
  apps: [
    {
      name: "bot-client",
      cwd: "./packages/bot-client",
      script: "index.ts",
      interpreter: "bun",
      exp_backoff_restart_delay: 100,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
    {
      name: "bot-backend",
      cwd: "./packages/backend",
      script: "./src/index.tsx",
      interpreter: "bun",
      exp_backoff_restart_delay: 150,
      cron_restart: "0 5 * * *",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm Z",
      env: {
        NODE_OPTIONS: "--max-old-space-size=3072",
      },
    },
  ],
};
