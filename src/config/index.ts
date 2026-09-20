import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const customEnvPath = process.env.ENV_FILE;
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const defaultEnvPath = path.resolve(__dirname, '../../.env');

let resolvedEnv = defaultEnvPath;
if (customEnvPath && fs.existsSync(customEnvPath)) {
  resolvedEnv = customEnvPath;
} else if (fs.existsSync(cwdEnvPath)) {
  resolvedEnv = cwdEnvPath;
}

dotenv.config({ path: resolvedEnv });

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    guildId: process.env.GUILD_ID || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    jwtSecret: process.env.JWT_SECRET || 'interpol_secret_key_default_development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  isDev: process.env.NODE_ENV !== 'production',
  envFilePath: resolvedEnv,
};

export default config;
