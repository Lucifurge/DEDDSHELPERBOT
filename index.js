require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");

/* =========================
   CRASH PROTECTION
========================= */
process.on("unhandledRejection", err => console.error("Unhandled:", err));
process.on("uncaughtException", err => console.error("Uncaught:", err));

/* =========================
   EXPRESS KEEP-ALIVE
========================= */
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Express running")
);

/* =========================
   DISCORD CLIENT
========================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* =========================
   STORAGE
========================= */
const dataFile = path.join(__dirname, "welcomeConfig.json");

const load = () =>
  fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile))
    : {};

const save = data =>
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

let config = load();

/* =========================
   SLASH COMMANDS
========================= */
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot status"),

  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome message")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Welcome channel").setRequired(true))
    .addStringOption(o =>
      o.setName("message").setDescription("Welcome message").setRequired(true))
    .addStringOption(o =>
      o.setName("color").setDescription("HEX color (ex: #00ff99)"))
    .addStringOption(o =>
      o.setName("gif").setDescription("GIF or image URL")),

  new SlashCommandBuilder()
    .setName("setgoodbye")
    .setDescription("Set goodbye message")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Goodbye channel").setRequired(true))
    .addStringOption(o =>
      o.setName("message").setDescription("Goodbye message").setRequired(true))
    .addStringOption(o =>
      o.setName("color").setDescription("HEX color"))
    .addStringOption(o =>
      o.setName("gif").setDescription("GIF or image URL"))
].map(c => c.toJSON());

/* =========================
   REGISTER COMMANDS
========================= */
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Commands registered");
  } catch (e) {
    console.error("Command error:", e);
  }
})();

/* =========================
   COMMAND HANDLER
========================= */
client.on("interactionCreate", async i => {
  if (!i.isCommand()) return;

  try {
    if (i.commandName === "ping") {
      return i.reply("🟢 Bot online");
    }

    if (i.commandName === "setwelcome") {
      config[i.guildId] ??= {};
      config[i.guildId].welcome = {
        channel: i.options.getChannel("channel").id,
        message: i.options.getString("message"),
        color: i.options.getString("color") || "#00ff99",
        gif: i.options.getString("gif")
      };
      save(config);
      return i.reply("✅ Welcome message set!");
    }

    if (i.commandName === "setgoodbye") {
      config[i.guildId] ??= {};
      config[i.guildId].goodbye = {
        channel: i.options.getChannel("channel").id,
        message: i.options.getString("message"),
        color: i.options.getString("color") || "#ff5555",
        gif: i.options.getString("gif")
      };
      save(config);
      return i.reply("✅ Goodbye message set!");
    }
  } catch (e) {
    console.error(e);
    if (!i.replied) i.reply("⚠️ Error handled safely");
  }
});

/* =========================
   WELCOME EVENT
========================= */
client.on("guildMemberAdd", async member => {
  const cfg = config[member.guild.id]?.welcome;
  if (!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if (!channel) return;

  const embed = {
    color: parseInt(cfg.color.replace("#", ""), 16),
    title: "🎉 Welcome!",
    description: cfg.message
      .replace("{user}", `<@${member.id}>`)
      .replace("{server}", member.guild.name),
    thumbnail: { url: member.user.displayAvatarURL() }
  };

  if (cfg.gif) embed.image = { url: cfg.gif };

  channel.send({ embeds: [embed] });
});

/* =========================
   GOODBYE EVENT
========================= */
client.on("guildMemberRemove", async member => {
  const cfg = config[member.guild.id]?.goodbye;
  if (!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if (!channel) return;

  const embed = {
    color: parseInt(cfg.color.replace("#", ""), 16),
    title: "👋 Goodbye",
    description: cfg.message
      .replace("{user}", member.user.tag)
      .replace("{server}", member.guild.name)
  };

  if (cfg.gif) embed.image = { url: cfg.gif };

  channel.send({ embeds: [embed] });
});

/* =========================
   READY
========================= */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
