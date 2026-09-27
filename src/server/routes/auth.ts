import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { UserSessionData } from '../../shared/types';
import { PermissionFlagsBits } from 'discord.js';

export const authRouter = Router();

export function buildUserPermissions(isAdmin: boolean, rolePermissions: any[]) {
  const modular: Record<string, boolean> = {};

  for (const rp of rolePermissions) {
    if (rp.permissionsJson) {
      try {
        const parsed = typeof rp.permissionsJson === 'string' ? JSON.parse(rp.permissionsJson) : rp.permissionsJson;
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (v) modular[k] = true;
          }
        }
      } catch {}
    }
  }

  const hasRecruitMod = Object.keys(modular).some(k => k.startsWith('recruitment.') && modular[k]);
  const hasAcademyMod = Object.keys(modular).some(k => k.startsWith('academy.') && modular[k]);
  const hasLeaveMod = Object.keys(modular).some(k => k.startsWith('leave.') && modular[k]);
  const hasEventMod = Object.keys(modular).some(k => k.startsWith('events.') && modular[k]);
  const hasProfileMod = Object.keys(modular).some(k => k.startsWith('profiles.') && modular[k]);
  const hasPayrollMod = Object.keys(modular).some(k => k.startsWith('payroll.') && modular[k]);
  const hasTierMod = Object.keys(modular).some(k => k.startsWith('tier.') && modular[k]);
  const hasSettingsMod = Boolean(modular['settings.rbac'] || modular['settings.botMessages'] || modular['settings.logs']);
  const hasLogMod = Boolean(modular['settings.logs'] || modular['leave.viewLogs']);

  return {
    isAdmin,
    manageSettings: isAdmin || rolePermissions.some(rp => rp.manageSettings) || hasSettingsMod,
    manageRecruiting: isAdmin || rolePermissions.some(rp => rp.manageRecruiting) || hasRecruitMod,
    manageEvents: isAdmin || rolePermissions.some(rp => rp.manageEvents) || hasEventMod,
    viewLogs: isAdmin || rolePermissions.some(rp => rp.viewLogs) || hasLogMod,
    manageAcademy: isAdmin || rolePermissions.some(rp => rp.manageAcademy) || hasAcademyMod,
    manageLeaves: isAdmin || hasLeaveMod,
    manageProfiles: isAdmin || hasProfileMod,
    manageTier: isAdmin || rolePermissions.some(rp => rp.manageTier) || hasTierMod,
    managePayroll: isAdmin || hasPayrollMod || rolePermissions.some(rp => rp.manageRecruiting),
    modular,
  };
}

// 1. Get Discord OAuth2 Login URL
authRouter.get('/login', (req: Request, res: Response) => {
  if (!config.discord.clientId) {
    return res.status(500).json({ error: 'CLIENT_ID not configured in .env' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const redirectUri = encodeURIComponent(config.discord.redirectUri);
  const scope = encodeURIComponent('identify guilds guilds.members.read');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

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

  const state = req.query.state as string;
  const storedState = req.cookies?.oauth_state;
  
  if (!state || !storedState || state !== storedState) {
    return res.redirect(`${redirectBase}/login?error=invalid_state`);
  }
  res.clearCookie('oauth_state');

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

    const permissions = buildUserPermissions(isAdmin, rolePermissions);

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

// 3. Get Current User Me (with live Discord & RBAC permission sync)
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const guildId = user.guildId || config.discord.guildId;
    if (guildId) {
      const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(user.userId).catch(() => null);
        if (member) {
          const roles = Array.from(member.roles.cache.keys());
          const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.id === guild.ownerId;
          const rolePermissions = await prisma.rolePermission.findMany({
            where: {
              guildId: guildId || '',
              roleId: { in: roles },
            },
          });
          user.roles = roles;
          user.permissions = buildUserPermissions(isAdmin, rolePermissions);
        }
      }
    }
  } catch (err) {
    // If fetching fails, fallback to session permissions
  }
  return res.json({ user });
});

// 4. Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ success: true });
});

export default authRouter;
