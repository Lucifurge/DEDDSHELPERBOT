require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");

/* =========================
   CRASH PROTECTION
========================= */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* =========================
   DISCORD CLIENT
========================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* =========================
   EXPRESS SERVER & FRONTEND
========================= */
const app = express();
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Homepage
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ STATUS API (THIS FIXES OFFLINE ISSUE)
app.get("/api/status", (_, res) => {
  res.json({
    online: client.isReady(),
    servers: client.guilds.cache.size,
    uptime: Math.floor(process.uptime())
  });
});

// Start web server
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Web server running")
);

/* =========================
   STORAGE
========================= */
const dataFile = path.join(__dirname, "welcomeConfig.json");
const load = () =>
  fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : {};
const save = data =>
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

let config = load();

/* =========================
   SLASH COMMANDS
========================= */
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot status"),

  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome message")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Welcome channel").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message").setDescription("Welcome message").setRequired(true)
    )
    .addStringOption(o => o.setName("color").setDescription("HEX color"))
    .addStringOption(o => o.setName("gif").setDescription("GIF or image URL")),

  new SlashCommandBuilder()
    .setName("setgoodbye")
    .setDescription("Set goodbye message")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Goodbye channel").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message").setDescription("Goodbye message").setRequired(true)
    )
    .addStringOption(o => o.setName("color").setDescription("HEX color"))
    .addStringOption(o => o.setName("gif").setDescription("GIF or image URL")),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement embed")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("title").setDescription("Embed title").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("description").setDescription("Embed description").setRequired(true)
    )
    .addStringOption(o => o.setName("color").setDescription("HEX color"))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF URL"))
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
    console.error("Command registration error:", e);
  }
})();

/* =========================
   COMMAND HANDLER
========================= */
client.on("interactionCreate", async i => {
  if (!i.isCommand()) return;

  try {
    if (i.commandName === "ping")
      return i.reply("🟢 Bot online");

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

    if (i.commandName === "announce") {
      const channel = i.options.getChannel("channel");
      const embed = new EmbedBuilder()
        .setTitle(i.options.getString("title"))
        .setDescription(i.options.getString("description"))
        .setColor(parseInt((i.options.getString("color") || "#00ffcc").replace("#",""),16))
        .setTimestamp();

      const image = i.options.getString("image");
      if (image) embed.setImage(image);

      await channel.send({ embeds: [embed] });
      return i.reply("✅ Announcement sent");
    }
  } catch (e) {
    console.error(e);
    if (!i.replied) i.reply("⚠️ Error handled safely");
  }
});

/* =========================
   MEMBER EVENTS
========================= */
client.on("guildMemberAdd", async member => {
  const cfg = config[member.guild.id]?.welcome;
  if (!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if (!channel) return;

  channel.send({
    embeds: [{
      title: "🎉 Welcome!",
      description: cfg.message
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name),
      color: parseInt(cfg.color.replace("#",""),16),
      thumbnail: { url: member.user.displayAvatarURL() },
      image: cfg.gif ? { url: cfg.gif } : undefined
    }]
  });
});

client.on("guildMemberRemove", async member => {
  const cfg = config[member.guild.id]?.goodbye;
  if (!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if (!channel) return;

  channel.send({
    embeds: [{
      title: "👋 Goodbye",
      description: cfg.message
        .replace("{user}", member.user.tag)
        .replace("{server}", member.guild.name),
      color: parseInt(cfg.color.replace("#",""),16),
      image: cfg.gif ? { url: cfg.gif } : undefined
    }]
  });
});

/* =========================
   READY & LOGIN
========================= */
client.once("ready", () =>
  console.log(`✅ Logged in as ${client.user.tag}`)
);

client.login(process.env.TOKEN);
