import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import config from '../config';
import authRouter from './routes/auth';
import guildRouter from './routes/guild';
import recruitmentRouter from './routes/recruitment';
import eventsRouter from './routes/events';
import logsRouter from './routes/logs';
import rbacRouter from './routes/rbac';
import statsRouter from './routes/stats';
import botMessagesRouter from './routes/botMessages';
import embedsRouter from './routes/embeds';
import profilesRouter from './routes/profiles';
import academyRouter from './routes/academy';
import leaveRouter from './routes/leave';
import payrollRouter from './routes/payroll';
import blacklistRouter from './routes/blacklist';
import botManagementRouter from './routes/botManagement';
import serverSetupRouter from './routes/serverSetup';
import nicknamesRouter from './routes/nicknames';
import tierRouter from './routes/tier';
import botActivityRouter from './routes/botActivity';
import honeypotRouter from './routes/honeypot';

export function createServer() {
  const app = express();

  // Support reverse proxies (OpenResty, Nginx, aaPanel, Cloudflare)
  app.set('trust proxy', true);

  // Middlewares
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Dashboard Backend Routes
  app.use('/api/auth', authRouter);
  app.use('/api/guild', guildRouter);
  app.use('/api/recruitment', recruitmentRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/rbac', rbacRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/bot-messages', botMessagesRouter);
  app.use('/api/embeds', embedsRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/academy', academyRouter);
  app.use('/api/leave', leaveRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/blacklist', blacklistRouter);
  app.use('/api/bot', botManagementRouter);
  app.use('/api/setup', serverSetupRouter);
  app.use('/api/nicknames', nicknamesRouter);
  app.use('/api/tier', tierRouter);
  app.use('/api/activity', botActivityRouter);
  app.use('/api/honeypot', honeypotRouter);

  // Health check for reverse proxies (OpenResty, Nginx, Uptime monitors)
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      port: config.server.port,
    });
  });

  // Serve production build of web dashboard if present
  const possiblePaths = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
    path.resolve(__dirname, '../web/dist'),
  ];
  const clientDist = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possiblePaths[0];

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }

  // SPA fallback for Express 5
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // Informative fallback page if web dashboard has not been built yet
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="5">
        <title>INTERPOL BOT • Web Dashboard</title>
        <style>
          body { background: #111214; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #18191c; border: 1px solid rgba(236,72,153,0.3); border-radius: 1.25rem; padding: 2.5rem; max-width: 520px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
          h1 { color: #ec4899; font-size: 1.5rem; margin-top: 0; margin-bottom: 0.5rem; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: rgba(16,185,129,0.15); color: #10b981; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
          code { background: #222328; padding: 0.2rem 0.4rem; border-radius: 0.25rem; color: #ec4899; font-size: 0.85rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="status">● Сервер активен (Port ${config.server.port})</div>
          <h1>🦅 INTERPOL BOT Dashboard</h1>
          <p>Бэкенд успешно запущен и работает. Веб-панель собирается или запустите <code>npm run build:web</code>.</p>
          <p style="font-size: 0.85rem; color: #64748b;">API Health: <a href="/api/health" style="color: #ec4899;">/api/health</a></p>
        </div>
      </body>
      </html>
    `);
  });

  // API 404 handler
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Server Error]', err?.stack || err);
    const statusCode = err.statusCode || err.status || 500;
    const message = config.isDev ? err.message : 'Internal server error';
    res.status(statusCode).json({ error: message });
  });

  return app;
}

export function startServer() {
  const app = createServer();
  const port = config.server.port;
  const host = process.env.HOST;

  const onListen = () => {
    console.log(`🌐 [Web Server] Web Dashboard running on port ${port} (${host || 'all IPv4/IPv6 interfaces'})`);
    console.log(`📡 [Web Server] Reverse proxy (OpenResty/Nginx) target: http://127.0.0.1:${port}`);
  };

  const server = host ? app.listen(port, host, onListen) : app.listen(port, onListen);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`💥 [Web Server Critical] Port ${port} is already in use by another process!`);
      console.error(`👉 This causes OpenResty to return "502 Bad Gateway". Terminate the old process holding port ${port}.`);
      process.exit(1);
    } else {
      console.error('💥 [Web Server Error]:', err);
    }
  });

  return server;
}

export default startServer;
