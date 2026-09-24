import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  ChatInputCommandInteraction,
  AutocompleteInteraction
} from 'discord.js';

export interface Command {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

class ExtendedClient extends Client {
  public commands: Collection<string, Command> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
      ],
    });

    // Resilience: Catch EventEmitter errors to prevent process termination
    this.on('error', (err) => {
      console.error('🔴 [Discord Client Error]:', err);
    });

    this.on('shardError', (err, shardId) => {
      console.error(`🔴 [Discord Shard ${shardId} Error]:`, err);
    });

    this.rest.on('rateLimited', (info) => {
      console.warn(`⚠️ [Discord RateLimit]: ${info.method} ${info.route} (timeout: ${info.timeToReset}ms)`);
    });
  }
}

export const bot = new ExtendedClient();
export default bot;
