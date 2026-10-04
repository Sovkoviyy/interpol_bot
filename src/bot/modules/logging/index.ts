import { registerMessageLogs } from './listeners/messageLogs';
import { registerMemberLogs } from './listeners/memberLogs';
import { registerRoleLogs } from './listeners/roleLogs';
import { registerChannelLogs } from './listeners/channelLogs';
import { registerVoiceLogs } from './listeners/voiceLogs';
import { registerInviteLogs } from './listeners/inviteLogs';
import { registerGuildLogs } from './listeners/guildLogs';

export function initializeLoggingModule() {
  registerMessageLogs();
  registerMemberLogs();
  registerRoleLogs();
  registerChannelLogs();
  registerVoiceLogs();
  registerInviteLogs();
  registerGuildLogs();
  console.log('✅ [LoggingModule] Server audit log listeners registered');
}

export * from './auditLogger';
