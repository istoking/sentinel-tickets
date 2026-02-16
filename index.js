const { Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { config } = require("./config.js");
const { client, ticketsDB } = require("./init.js");
const {
  cleanBlacklist,
  logError,
  lastChannelMsgTimestamp,
  updateStatsChannels,
} = require("./utils/mainUtils.js");
const { autoCloseTicket } = require("./utils/ticketAutoClose.js");
const { autoDeleteTicket } = require("./utils/ticketAutoDelete.js");


(async () => {
client.startingTime = Date.now();

function guardedInterval(fn) {
  let running = false;

  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (error) {
      try {
        await logError("SCHEDULED_TASK_ERROR", error);
      } catch {
        console.log(error);
      }
    } finally {
      running = false;
    }
  };
}

const blacklistInterval = Number(config.blacklistCleanup) || 120;
setInterval(guardedInterval(cleanBlacklist), Math.max(blacklistInterval, 30) * 1000);

async function autoCloseTickets() {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const tickets = (await ticketsDB.all()) || [];
  const openTickets = tickets.filter((ticket) => ticket.value?.status === "Open");
  const autoCloseTime = Number(config?.autoCloseTickets?.time) || 86400;

  for (const ticket of openTickets) {
    const channelID = ticket.id;
    const lastMsgTime = await lastChannelMsgTimestamp(channelID);
    if (lastMsgTime === null) continue;

    const lastMsgTimeSeconds = Math.floor(lastMsgTime / 1000);
    const timeDifference = currentTime - lastMsgTimeSeconds;

    if (timeDifference > autoCloseTime) {
      await autoCloseTicket(channelID);
    }
  }
}

async function autoDeleteTickets() {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const tickets = (await ticketsDB.all()) || [];
  const closedTickets = tickets.filter((ticket) => ticket.value?.status === "Closed");
  const autoDeleteTime = Number(config?.autoDeleteTickets?.time) || 86400;

  for (const ticket of closedTickets) {
    const channelID = ticket.id;
    const closedAt = ticket.value?.closedAt;

    if (!closedAt) continue;

    const closedAtSeconds = Math.floor(closedAt / 1000);
    const timeDifference = currentTime - closedAtSeconds;

    if (timeDifference > autoDeleteTime) {
      await autoDeleteTicket(channelID);
    }
  }
}

if (config?.autoCloseTickets?.enabled) {
  const autoCloseInterval = Number(config?.autoCloseTickets?.interval) || 60;
  setInterval(guardedInterval(autoCloseTickets), Math.max(autoCloseInterval, 30) * 1000);
}

if (config?.autoDeleteTickets?.enabled) {
  const autoDeleteInterval = Number(config?.autoDeleteTickets?.interval) || 60;
  setInterval(guardedInterval(autoDeleteTickets), Math.max(autoDeleteInterval, 30) * 1000);
}

if (config?.statsChannels?.enabled) {
  const statsInterval = Number.parseInt(config?.statsChannels?.interval, 10) || 600;
  const statsIntervalMs = Math.max(statsInterval * 1000, 600 * 1000);
  setInterval(guardedInterval(updateStatsChannels), statsIntervalMs);
}

// Holding commands cooldown data
client.cooldowns = new Collection();

// Reading command files
client.commands = new Collection();
const commandFolders = fs.readdirSync("./commands");
for (const folder of commandFolders) {
  const commandFiles = fs
    .readdirSync(`./commands/${folder}`)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${folder}/${file}`);
      if (command?.enabled) {
        if (!config.silentStartup) {
          console.log(`The slash command [${file}] has been loaded!`);
        }
        client.commands.set(command.data.name, command);
      }
    } catch (error) {
      error.errorContext = `[Command Load Error]: ./commands/${folder}/${file}`;
      console.log(error);
      await logError("COMMAND_LOAD_ERROR", error);
    }
  }
}

// Reading event files
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  try {
    const event = require(filePath);

    const safeExecute = async (...args) => {
      try {
        await event.execute(...args);
      } catch (error) {
        error.errorContext = `[Event Handler Error]: ${event.name}`;
        console.log(error);
        await logError("EVENT_HANDLER_ERROR", error);
      }
    };

    if (event.once) {
      client.once(event.name, safeExecute);
    } else {
      client.on(event.name, safeExecute);
    }
  } catch (error) {
    error.errorContext = `[Event Load Error]: ${filePath}`;
    console.log(error);
    await logError("EVENT_LOAD_ERROR", error);
  }
}

// Error handlers
client.on("warn", async (error) => {
  console.log(error);
  await logError("WARN", error);
});

client.on("error", async (error) => {
  console.log(error);
  await logError("ERROR", error);
});

process.on("unhandledRejection", async (error) => {
  console.log(error);
  await logError("unhandledRejection", error);
});

process.on("uncaughtException", async (error) => {
  console.log(error);
  await logError("uncaughtException", error);
});

process.on("SIGINT", async () => {
  try {
    await logError("SHUTDOWN", new Error("Process received SIGINT"));
  } catch {}
  process.exit(0);
});

// Log in to Discord with your app's token
client.login(process.env.BOT_TOKEN).catch(async (error) => {
  if (error?.message?.includes("An invalid token was provided")) {
    console.log(error);
    await logError("INVALID_TOKEN", error);
    process.exit(1);
  }

  if (
    error?.message?.includes(
      "Privileged intent provided is not enabled or whitelisted.",
    )
  ) {
    console.log(error);
    await logError("DISALLOWED_INTENTS", error);
    process.exit(1);
  }

  console.log(error);
  await logError("ERROR", error);
  process.exit(1);
});
})();
