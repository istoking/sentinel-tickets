const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { ticketsDB } = require("../../init.js");
const { checkSupportRole } = require("../../utils/mainUtils.js");
const { reopenTicket } = require("../../utils/ticketReopen.js");
const { config } = require("../../config.js");

module.exports = {
  enabled: config.commands.reopen.enabled,
  data: new SlashCommandBuilder()
    .setName("reopen")
    .setDescription("Re-Open a closed ticket.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.reopen.permission],
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

    if ((await ticketsDB.get(`${interaction.channel.id}.status`)) === "Open") {
      return interaction.reply({
        content: "This ticket is already open!",
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

    await interaction.deferReply();
    await reopenTicket(interaction);
  },
};
