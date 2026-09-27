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

  if (!config.isDev && config.server.jwtSecret.includes('default_development')) {
    console.error('❌ [FATAL] Default JWT_SECRET detected in production mode! Set JWT_SECRET in .env immediately.');
    process.exit(1);
  }

  // 0. Ensure Database Schema is Up-to-Date (Auto-migrates SQLite columns)
  await ensureDatabaseSchema();

  // 1. Start Web Dashboard Server
  startServer();

  // 2. Start Discord Bot
  await startBot();
}

main().catch(err => {
  console.error('💥 [Fatal Startup Error]:', err);
});
