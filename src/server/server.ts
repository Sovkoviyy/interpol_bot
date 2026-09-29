import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
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

  // Support reverse proxies (OpenResty, Nginx, Cloudflare)
  app.set('trust proxy', 1);

  // Middlewares
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
 
  // Rewrite /api/api/* -> /api/* for reverse-proxy resilience
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/api/')) {
      req.url = req.url.replace(/^\/api\/api\//, '/api/');
    }
    next();
  });

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

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
  });

  // Serve production build of web dashboard if present
  const clientDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(clientDist));

  // SPA fallback for Express 5
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), err => {
      if (err) next();
    });
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
  const host = '0.0.0.0';
  const server = app.listen(config.server.port, host, () => {
    console.log(`🌐 [Web Server] Web Dashboard running on http://${host}:${config.server.port} (port ${config.server.port})`);
  });
  return server;
}

export default startServer;
