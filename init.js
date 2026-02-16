const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { QuickDB } = require("quick.db");
const { config } = require("./config.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Check if the data directory exists, and if not, create it
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const mainDB = new QuickDB({ filePath: path.join(dataDir, "main.sqlite") });
const ticketsDB = new QuickDB({ filePath: path.join(dataDir, "tickets.sqlite") });
const blacklistDB = new QuickDB({ filePath: path.join(dataDir, "blacklist.sqlite") });

(async function () {
  // Initialize defaults if they don't exist
  const defaults = {
    totalTickets: 1,
    openTickets: 0,
    totalClaims: 0,
    totalReviews: 0,
    ratings: [],
    totalMessages: 0,
    ticketCreators: [],
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!(await mainDB.has(key))) {
      await mainDB.set(key, value);
    }
  }
})();

// Extract information from the config.yml to properly setup the ticket categories
const ticketCategories = [];
const configuredCategories = Array.isArray(config?.TicketCategories)
  ? config.TicketCategories
  : [];

for (const category of configuredCategories) {
  const {
    id,
    name,
    nameEmoji,
    categoryID,
    closedCategoryID,
    support_role_ids,
    permissions,
    pingRoles,
    ping_role_ids,
    ghostPingRoles,
    textContent,
    creatorRoles,
    buttonEmoji,
    buttonLabel,
    buttonStyle,
    menuEmoji,
    menuLabel,
    menuDescription,
    embedTitle,
    color,
    description,
    ticketName,
    ticketTopic,
    slowmode,
    useCodeBlocks,
    modalTitle,
    questions,
  } = category || {};

  const extractedQuestions = Array.isArray(questions)
    ? questions.map((question) => {
        const { label, placeholder, style, required, minLength, maxLength } =
          question || {};

        return {
          label,
          placeholder,
          style,
          required,
          minLength,
          maxLength,
        };
      })
    : [];

  if (id === undefined || id === null) {
    continue;
  }

  ticketCategories[id] = {
    name,
    nameEmoji,
    categoryID,
    closedCategoryID,
    support_role_ids,
    permissions,
    pingRoles,
    ping_role_ids,
    ghostPingRoles,
    textContent,
    creatorRoles,
    buttonEmoji,
    buttonLabel,
    buttonStyle,
    menuEmoji,
    menuLabel,
    menuDescription,
    embedTitle,
    color,
    description,
    ticketName,
    ticketTopic,
    slowmode,
    useCodeBlocks,
    modalTitle,
    questions: extractedQuestions,
  };
}

module.exports = {
  client,
  ticketCategories,
  mainDB,
  ticketsDB,
  blacklistDB,
};
