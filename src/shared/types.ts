export interface FormQuestion {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  style: 'SHORT' | 'PARAGRAPH';
  maxLength?: number;
}

export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';

export type EventType = 'UNLIMITED' | 'LIMITED';
export type EventStatus = 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type ParticipantStatus = 'CONFIRMED' | 'RESERVE';

export type LogCategoryType = 
  | 'MESSAGES'
  | 'MEMBERS'
  | 'ROLES'
  | 'CHANNELS'
  | 'VOICE'
  | 'INVITES'
  | 'BOT';

export interface RolePermissionDTO {
  roleId: string;
  roleName?: string;
  manageSettings: boolean;
  manageRecruiting: boolean;
  manageEvents: boolean;
  viewLogs: boolean;
}

export interface UserSessionData {
  userId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  guildId: string;
  roles: string[];
  permissions: {
    isAdmin: boolean;
    manageSettings: boolean;
    manageRecruiting: boolean;
    manageEvents: boolean;
    viewLogs: boolean;
  };
}
