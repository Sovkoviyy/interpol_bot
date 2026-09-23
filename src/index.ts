import config from './config';
import { startBot } from './bot';
import { startServer } from './server/server';

// Global Process Resilience Handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 [Process] Uncaught Exception:', err);
});

async function main() {
  console.log('========================================================');
  console.log('🚀 [INTERPOL BOT] Starting Family Discord Bot & Dashboard');
  console.log('========================================================');

  if (!config.isDev && config.server.jwtSecret.includes('default_development')) {
    console.warn('⚠️ [SECURITY WARNING] Default JWT_SECRET is active in production mode! Set JWT_SECRET in .env for security.');
  }

  // 1. Start Express Web Server & API
  startServer();

  // 2. Start Discord Bot
  await startBot();
}

main().catch(err => {
  console.error('💥 [Fatal Startup Error]:', err);
});
