import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { requireAuth, AuthenticatedRequest, userSessionCache } from '../middlewares/auth';
import { UserSessionData } from '../../shared/types';
import { PermissionFlagsBits } from 'discord.js';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireBot } from "../middlewares/requireBot";

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
            } catch { }
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

// Short-term cache for recently exchanged authorization codes (handles double-clicks, browser reloads, reverse proxy retries)
const exchangedCodeCache = new Map<string, { token: string; timestamp: number }>();

function cleanupCodeCache() {
    const now = Date.now();
    for (const [c, item] of exchangedCodeCache.entries()) {
        if (now - item.timestamp > 60000) {
            exchangedCodeCache.delete(c);
        }
    }
}

export function getBaseUrl(req: Request): string {
    // If explicitly configured in .env and not default localhost:5173
    if (
        config.server.frontendUrl &&
        !config.server.frontendUrl.includes('5173') &&
        !config.server.frontendUrl.includes('localhost')
    ) {
        return config.server.frontendUrl.replace(/\/+$/, '');
    }

    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();

    if (host) {
        return `${proto}://${host}`.replace(/\/+$/, '');
    }

    return (config.server.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
}

export function getEffectiveRedirectUri(req: Request): string {
    const reqHost = req.get('x-forwarded-host') || req.get('host') || '';
    const isLocalRequest = reqHost.includes('localhost') || reqHost.includes('127.0.0.1');

    // If DISCORD_REDIRECT_URI in .env is configured and is not default localhost, or request is local
    if (config.discord.redirectUri && (!config.discord.redirectUri.includes('localhost') || isLocalRequest)) {
        return config.discord.redirectUri.trim();
    }

    // Deployed behind reverse proxy (e.g. OpenResty) with domain or public IP
    if (!isLocalRequest && reqHost) {
        const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
        return `${proto}://${reqHost}/api/auth/callback`;
    }

    return (config.discord.redirectUri || 'http://localhost:3001/api/auth/callback').trim();
}

function createSignedState(nonce: string, redirectUri: string): string {
    const payload = JSON.stringify({ n: nonce, r: redirectUri, t: Date.now() });
    const sig = crypto.createHmac('sha256', config.server.jwtSecret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ p: payload, s: sig })).toString('base64url');
}

function parseSignedState(rawState: string): { nonce?: string; redirectUri?: string; isValid: boolean } {
    try {
        const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf-8'));
        if (parsed.p && parsed.s) {
            const expected = crypto.createHmac('sha256', config.server.jwtSecret).update(parsed.p).digest('hex');
            if (crypto.timingSafeEqual(Buffer.from(parsed.s, 'hex'), Buffer.from(expected, 'hex'))) {
                const payload = JSON.parse(parsed.p);
                if (Date.now() - payload.t < 15 * 60 * 1000) {
                    return { nonce: payload.n, redirectUri: payload.r, isValid: true };
                }
            }
        }
    } catch { }
    return { isValid: false };
}

// 1. Get Discord OAuth2 Login URL
authRouter.get('/login', (req: Request, res: Response) => {
    if (!config.discord.clientId) {
        return res.status(500).json({ error: 'CLIENT_ID not configured in .env' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const redirectUri = getEffectiveRedirectUri(req);
    const state = createSignedState(nonce, redirectUri);

    const isSecure = Boolean(req.secure || req.get('x-forwarded-proto') === 'https');

    res.cookie('oauth_state', nonce, {
        httpOnly: true,
        secure: isSecure && !config.isDev,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
    });

    res.cookie('oauth_redirect_uri', redirectUri, {
        httpOnly: true,
        secure: isSecure && !config.isDev,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });

    const scope = encodeURIComponent('identify guilds guilds.members.read');
    const url = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;

    return res.json({ url });
});

// 2. OAuth2 Callback
authRouter.get('/callback', requireBot, asyncHandler(async (req: Request, res: Response) => {

    cleanupCodeCache();

    const code = (req.query.code as string)?.trim();
    const rawState = (req.query.state as string)?.trim();
    const redirectBase = getBaseUrl(req);

    if (!code) {
        return res.redirect(`${redirectBase}/login?error=no_code`);
    }

    // Handle replayed code (e.g. browser refreshed or proxy retried)
    if (exchangedCodeCache.has(code)) {
        const cached = exchangedCodeCache.get(code)!;
        return res.redirect(`${redirectBase}/dashboard?token=${cached.token}`);
    }

    const { nonce: stateNonce, redirectUri: stateRedirectUri, isValid: isSignatureValid } = rawState
        ? parseSignedState(rawState)
        : { isValid: false };

    const storedNonce = req.cookies?.oauth_state;
    const isCookieMatch = Boolean(storedNonce && (rawState === storedNonce || stateNonce === storedNonce));

    if (!isSignatureValid && !isCookieMatch && !config.isDev) {
        return res.redirect(`${redirectBase}/login?error=invalid_state`);
    }

    res.clearCookie('oauth_state');
    res.clearCookie('oauth_redirect_uri');

    const effectiveRedirectUri = stateRedirectUri || req.cookies?.oauth_redirect_uri || getEffectiveRedirectUri(req);

    try {
        // Exchange code for token
        const tokenRes = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: config.discord.clientId,
                client_secret: config.discord.clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: effectiveRedirectUri,
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000,
            }
        );

        const accessToken = tokenRes.data.access_token;

        // Fetch user profile
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
        });
        const discordUser = userRes.data;

        // Determine guild roles
        const guildId = config.discord.guildId;
        let roles: string[] = [];
        let isAdmin = false;

        if (guildId) {
            const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
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

        // Store in-memory session to keep JWT under 150 bytes and eliminate Nginx 502 header overflow
        userSessionCache.set(discordUser.id, sessionData);

        const compactJwtPayload = {
            userId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar,
            guildId: guildId || '',
            isAdmin,
        };

        // Sign ultra-compact JWT token
        const token = jwt.sign(compactJwtPayload, config.server.jwtSecret, { expiresIn: '7d' });

        // Cache this code exchange for 60 seconds
        exchangedCodeCache.set(code, { token, timestamp: Date.now() });

        // Set cookie and redirect to frontend dashboard
        const isSecure = Boolean(req.secure || req.get('x-forwarded-proto') === 'https');
        res.cookie('token', token, {
            httpOnly: true,
            secure: isSecure && !config.isDev,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.redirect(`${redirectBase}/dashboard?token=${token}`);
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        console.error('[OAuth2 Error]:', errorData);
        const errorParam = typeof errorData === 'object' ? (errorData.error || errorData.message || 'auth_failed') : 'auth_failed';
        return res.redirect(`${redirectBase}/login?error=${encodeURIComponent(errorParam)}`);
    }
}));

// 3. Get Current User Me (with live Discord & RBAC permission sync)
authRouter.get('/me', requireAuth, requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const user = req.user!;
    try {
        const guildId = user.guildId || config.discord.guildId;
        if (guildId) {
            const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
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
    userSessionCache.set(user.userId, user);
    return res.json({ user });
}));

// 4. Logout
authRouter.post('/logout', (req: Request, res: Response) => {
    res.clearCookie('token');
    return res.json({ success: true });
});

export default authRouter;
