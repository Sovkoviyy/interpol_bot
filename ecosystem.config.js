module.exports = {
  apps: [
    {
      name: 'interpol_bot',
      script: 'start.js',
      args: '--no-supervisor',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
