module.exports = {
  name: "app", // Name of your application
  script: "index.ts", // Entry point of your application
  interpreter: "~/.bun/bin/bun", // Path to the Bun interpreter
  exp_backoff_restart_delay: 100,
  log_date_format : "YYYY-MM-DD HH:mm Z"
};
