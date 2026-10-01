import config from './config';
import { startBot } from './bot';
import { startServer } from './server/server';
import { ensureDatabaseSchema } from './database/ensureSchema';

// Global Process Resilience Handlers
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('⚠️ [Process Resilience] Unhandled Rejection at:', promise, 'reason:', reason?.stack || reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('💥 [Process Resilience] Uncaught Exception intercepted:', err?.stack || err);
});

async function main() {
  console.log('========================================================');
  console.log('🚀 [INTERPOL BOT] Starting Family Discord Bot & Dashboard');
  console.log('========================================================');

  if (config.server.jwtSecret.includes('default_development')) {
    console.warn('⚠️ [SECURITY WARNING] Default JWT_SECRET is in use! Please set a unique JWT_SECRET in .env.');
  }

  // 1. Start Web Dashboard Server immediately so reverse proxies (OpenResty, Nginx) get 200 OK
  startServer();

  // 2. Ensure Database Schema is Up-to-Date (Auto-migrates SQLite columns)
  try {
    await ensureDatabaseSchema();
  } catch (err: any) {
    console.warn('⚠️ [Database Schema Warning]:', err?.message || err);
  }

  // 3. Start Discord Bot
  try {
    await startBot();
  } catch (err: any) {
    console.warn('⚠️ [Discord Bot Warning]:', err?.message || err);
  }
}

main().catch(err => {
  console.error('💥 [Fatal Startup Error]:', err);
});
