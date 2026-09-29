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
      presence: {
        status: 'online',
        activities: [
          {
            name: 'Majestic RP • Dallas',
            type: 0,
          },
          {
            name: 'Custom Status',
            type: 4,
            state: 'Majestic RP • Dallas | INTERPOL',
          },
        ],
      },
    });

    // Resilience: Catch EventEmitter errors to prevent process termination
    this.on('error', (err) => {
      console.error('🔴 [Discord Client Error]:', err);
    });

    this.on('shardError', (err, shardId) => {
      console.error(`🔴 [Discord Shard ${shardId} Error]:`, err);
    });

    this.rest.on('rateLimited', (info) => {
      const waitSec = (info.timeToReset / 1000).toFixed(1);
      if (info.timeToReset > 15000) {
        console.warn(`⚠️ [Discord RateLimit Queue]: ${info.method} ${info.route} (REST queue waiting ${waitSec}s for bucket reset)`);
      } else {
        console.log(`ℹ️ [Discord Queue]: ${info.method} ${info.route} (auto-queued for ${waitSec}s, will retry automatically)`);
      }
    });
  }
}

export const bot = new ExtendedClient();
export default bot;
