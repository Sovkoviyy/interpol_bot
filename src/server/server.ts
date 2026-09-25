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
import voiceTrackerRouter from './routes/voiceTracker';
import leaveRouter from './routes/leave';
import payrollRouter from './routes/payroll';
import blacklistRouter from './routes/blacklist';
import antiNukeRouter from './routes/antiNuke';
import botManagementRouter from './routes/botManagement';
import serverSetupRouter from './routes/serverSetup';
import testModeRouter from './routes/testMode';
import nicknamesRouter from './routes/nicknames';

export function createServer() {
  const app = express();

  // Middlewares
  app.use(cors({
    origin: [config.server.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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
  app.use('/api/voice-tracker', voiceTrackerRouter);
  app.use('/api/leave', leaveRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/blacklist', blacklistRouter);
  app.use('/api/anti-nuke', antiNukeRouter);
  app.use('/api/bot', botManagementRouter);
  app.use('/api/setup', serverSetupRouter);
  app.use('/api/test-mode', testModeRouter);
  app.use('/api/nicknames', nicknamesRouter);

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

  return app;
}

export function startServer() {
  const app = createServer();
  const server = app.listen(config.server.port, () => {
    console.log(`🌐 [Web Server] Web Dashboard running at http://localhost:${config.server.port}`);
  });
  return server;
}

export default startServer;
