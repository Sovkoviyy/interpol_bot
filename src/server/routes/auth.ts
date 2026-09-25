import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { UserSessionData } from '../../shared/types';
import { PermissionFlagsBits } from 'discord.js';

export const authRouter = Router();

// 1. Get Discord OAuth2 Login URL
authRouter.get('/login', (req: Request, res: Response) => {
  if (!config.discord.clientId) {
    return res.status(500).json({ error: 'CLIENT_ID not configured in .env' });
  }

  const redirectUri = encodeURIComponent(config.discord.redirectUri);
  const scope = encodeURIComponent('identify guilds guilds.members.read');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

  return res.json({ url });
});

// 2. OAuth2 Callback
authRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const reqHost = req.get('host');
  let redirectBase = config.server.frontendUrl;

  // When frontend is served directly by Express (e.g. localhost:3001 or VPS), redirect to current host
  if (reqHost && config.server.frontendUrl.includes('5173') && !reqHost.includes('5173')) {
    redirectBase = `${req.protocol}://${reqHost}`;
  }

  if (!code) {
    return res.redirect(`${redirectBase}/login?error=no_code`);
  }

  try {
    // Exchange code for token
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discord.redirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch user profile
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const discordUser = userRes.data;

    // Determine guild roles
    const guildId = config.discord.guildId;
    let roles: string[] = [];
    let isAdmin = false;

    if (guildId) {
      const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(discordUser.id).catch(() => null);
        if (member) {
          roles = Array.from(member.roles.cache.keys());
          isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.id === guild.ownerId;
        }
      }
    }

    // Determine user's permissions by checking all assigned roles in database
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        guildId: guildId || '',
        roleId: { in: roles },
      },
    });

    const permissions = {
      isAdmin,
      manageSettings: isAdmin || rolePermissions.some(rp => rp.manageSettings),
      manageRecruiting: isAdmin || rolePermissions.some(rp => rp.manageRecruiting),
      manageEvents: isAdmin || rolePermissions.some(rp => rp.manageEvents),
      viewLogs: isAdmin || rolePermissions.some(rp => rp.viewLogs),
    };

    const sessionData: UserSessionData = {
      userId: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator || '0',
      avatar: discordUser.avatar,
      guildId: guildId || '',
      roles,
      permissions,
    };

    // Sign JWT token
    const token = jwt.sign(sessionData, config.server.jwtSecret, { expiresIn: '7d' });

    // Set cookie and redirect to frontend dashboard
    res.cookie('token', token, {
      httpOnly: true,
      secure: !config.isDev,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${redirectBase}/dashboard?token=${token}`);
  } catch (error: any) {
    console.error('[OAuth2 Error]:', error.response?.data || error.message);
    return res.redirect(`${redirectBase}/login?error=auth_failed`);
  }
});

// 3. Dev Login (kept active per user request for easy testing/staging; remove before public release)
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  const sessionData: UserSessionData = {
    userId: '111122223333444455',
    username: 'Family_Leader',
    discriminator: '0',
    avatar: null,
    guildId: config.discord.guildId || 'default_guild',
    roles: ['admin_role'],
    isBypass: true,
    permissions: {
      isAdmin: true,
      manageSettings: true,
      manageRecruiting: true,
      manageEvents: true,
      viewLogs: true,
    },
  };

  const token = jwt.sign(sessionData, config.server.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  return res.json({ token, user: sessionData });
});

// 4. Get Current User Me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// 5. Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ success: true });
});

export default authRouter;
