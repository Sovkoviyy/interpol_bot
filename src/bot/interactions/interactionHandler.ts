import { Interaction, Events } from 'discord.js';
import bot from '../client';
import { RecruitmentService } from '../modules/recruitment/recruitmentService';
import { EventService } from '../modules/events/eventService';

export function registerInteractionHandler() {
  bot.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // 1. Slash commands
      if (interaction.isChatInputCommand()) {
        const command = bot.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // 2. Buttons
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Recruitment Buttons
        if (customId === 'recruit_apply_button') {
          const modal = await RecruitmentService.buildApplicationModal(interaction.guildId!);
          await interaction.showModal(modal);
          return;
        }

        if (customId.startsWith('recruit_claim_')) {
          const applicationId = customId.replace('recruit_claim_', '');
          await RecruitmentService.handleClaim(interaction, applicationId);
          return;
        }

        if (customId.startsWith('recruit_approve_')) {
          const applicationId = customId.replace('recruit_approve_', '');
          await RecruitmentService.handleApprove(interaction, applicationId);
          return;
        }

        if (customId.startsWith('recruit_reject_')) {
          const applicationId = customId.replace('recruit_reject_', '');
          await RecruitmentService.promptRejectModal(interaction, applicationId);
          return;
        }

        // Event Buttons
        if (customId.startsWith('event_join_')) {
          const eventId = customId.replace('event_join_', '');
          await EventService.handleJoin(interaction, eventId, false);
          return;
        }

        if (customId.startsWith('event_reserve_')) {
          const eventId = customId.replace('event_reserve_', '');
          await EventService.handleJoin(interaction, eventId, true);
          return;
        }

        if (customId.startsWith('event_leave_')) {
          const eventId = customId.replace('event_leave_', '');
          await EventService.handleLeave(interaction, eventId);
          return;
        }

        if (customId.startsWith('event_manage_')) {
          const eventId = customId.replace('event_manage_', '');
          await EventService.promptManagement(interaction, eventId);
          return;
        }
      }

      // 3. Modals
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId === 'recruit_modal_submit') {
          await RecruitmentService.handleModalSubmit(interaction);
          return;
        }

        if (customId.startsWith('recruit_modal_reject_')) {
          const applicationId = customId.replace('recruit_modal_reject_', '');
          await RecruitmentService.handleRejectSubmit(interaction, applicationId);
          return;
        }
      }

      // 4. Select Menus
      if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        if (customId.startsWith('event_admin_kick_')) {
          await EventService.handleAdminKick(interaction);
          return;
        }
      }
    } catch (error) {
      console.error('[InteractionHandler Error]:', error);
      if (interaction.isRepliable()) {
        const replyOptions = { content: '❌ Произошла ошибка при выполнении действия.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(replyOptions).catch(() => null);
        } else {
          await interaction.reply(replyOptions).catch(() => null);
        }
      }
    }
  });
}
