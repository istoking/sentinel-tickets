const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { ticketsDB } = require("../../init.js");
const { checkSupportRole } = require("../../utils/mainUtils.js");
const { transcriptTicket } = require("../../utils/ticketTranscript.js");
const { config } = require("../../config.js");

module.exports = {
  enabled: config.commands.transcript.enabled,
  data: new SlashCommandBuilder()
    .setName("transcript")
    .setDescription("Manually save the transcript of a ticket.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.transcript.permission],
    )
    .setDMPermission(false),
  async execute(interaction) {
    if (!(await ticketsDB.has(interaction.channel.id))) {
      return interaction.reply({
        content:
          config.errors.not_in_a_ticket || "You are not in a ticket channel!",
        ephemeral: true,
      });
    }

    const hasSupportRole = await checkSupportRole(interaction);
    if (!hasSupportRole) {
      return interaction.reply({
        content:
          config.errors.not_allowed || "You are not allowed to use this!",
        ephemeral: true,
      });
    }
    const isEphemeral =
      config.transcriptReplyEmbed.ephemeral !== undefined
        ? config.transcriptReplyEmbed.ephemeral
        : true;
    await interaction.deferReply({ ephemeral: isEphemeral });
    await transcriptTicket(interaction);
  },
};
