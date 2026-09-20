import config from './config';
import { startBot } from './bot';
import { startServer } from './server/server';

async function main() {
  console.log('========================================================');
  console.log('🚀 [INTERPOL BOT] Starting Family Discord Bot & Dashboard');
  console.log('========================================================');

  // 1. Start Express Web Server & API
  startServer();

  // 2. Start Discord Bot
  await startBot();
}

main().catch(err => {
  console.error('💥 [Fatal Startup Error]:', err);
});
