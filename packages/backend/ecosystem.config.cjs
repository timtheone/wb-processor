module.exports = {
  name: "backend", // Name of your application
  script: "src/index.tsx", // Entry point of your application
  interpreter: "bun", // Path to the Bun interpreter
  // exp_backoff_restart_delay: 100,
  time: true,
  log_date_format : "YYYY-MM-DD HH:mm Z"
};
