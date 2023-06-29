module.exports = {
  apps: [
    {
      name: "weather-station-api",
      exec_mode: "cluster",
      instances: "1",
      script: "./index.js",
      env: {
        ENVIRONMENT: "production"
      },
    },
  ],
};