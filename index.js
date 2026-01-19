require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");

/* =========================
   CRASH PROTECTION
========================= */
process.on("unhandledRejection", err => console.error("Unhandled:", err));
process.on("uncaughtException", err => console.error("Uncaught:", err));

/* =========================
   EXPRESS SERVER & FRONTEND
========================= */
const app = express();

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html on root
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(process.env.PORT || 3000, () => console.log("✅ Express running"));

/* =========================
   DISCORD CLIENT
========================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* =========================
   STORAGE
========================= */
const dataFile = path.join(__dirname, "welcomeConfig.json");
const load = () => fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : {};
const save = (data) => fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
let config = load();

/* =========================
   SLASH COMMANDS
========================= */
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot status"),

  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome message")
    .addChannelOption(o => o.setName("channel").setDescription("Welcome channel").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Welcome message").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("HEX color (ex: #00ff99)"))
    .addStringOption(o => o.setName("gif").setDescription("GIF or image URL")),

  new SlashCommandBuilder()
    .setName("setgoodbye")
    .setDescription("Set goodbye message")
    .addChannelOption(o => o.setName("channel").setDescription("Goodbye channel").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Goodbye message").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("HEX color"))
    .addStringOption(o => o.setName("gif").setDescription("GIF or image URL")),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement embed")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to announce").setRequired(true))
    .addStringOption(o => o.setName("title").setDescription("Title of the embed").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description for the embed").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("HEX color for embed"))
    .addStringOption(o => o.setName("image").setDescription("Image/GIF URL"))
].map(c => c.toJSON());

/* =========================
   REGISTER COMMANDS
========================= */
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered");
  } catch (e) {
    console.error("Command registration error:", e);
  }
})();

/* =========================
   COMMAND HANDLER
========================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  try {
    switch(interaction.commandName) {
      case "ping":
        return interaction.reply("🟢 Bot online");

      case "setwelcome":
        config[interaction.guildId] ??= {};
        config[interaction.guildId].welcome = {
          channel: interaction.options.getChannel("channel").id,
          message: interaction.options.getString("message"),
          color: interaction.options.getString("color") || "#00ff99",
          gif: interaction.options.getString("gif") || null
        };
        save(config);
        return interaction.reply("✅ Welcome message set!");

      case "setgoodbye":
        config[interaction.guildId] ??= {};
        config[interaction.guildId].goodbye = {
          channel: interaction.options.getChannel("channel").id,
          message: interaction.options.getString("message"),
          color: interaction.options.getString("color") || "#ff5555",
          gif: interaction.options.getString("gif") || null
        };
        save(config);
        return interaction.reply("✅ Goodbye message set!");

      case "announce":
        const channel = interaction.options.getChannel("channel");
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        let color = interaction.options.getString("color") || "#00ffcc";
        const image = interaction.options.getString("image") || null;

        color = parseInt(color.replace("#",""), 16);

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setTimestamp();

        if(image) embed.setImage(image);

        await channel.send({ embeds: [embed] });
        return interaction.reply(`✅ Announcement sent to ${channel}`);
    }
  } catch (e) {
    console.error(e);
    if(!interaction.replied) interaction.reply("⚠️ Error handled safely");
  }
});

/* =========================
   WELCOME EVENT
========================= */
client.on("guildMemberAdd", async member => {
  const cfg = config[member.guild.id]?.welcome;
  if(!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if(!channel) return;

  let color = parseInt(cfg.color.replace("#",""),16);
  if(isNaN(color)) color = 0x00ff99;

  const embed = {
    color,
    title: `🎉 Welcome!`,
    description: cfg.message.replace("{user}", `<@${member.id}>`).replace("{server}", member.guild.name),
    thumbnail: { url: member.user.displayAvatarURL() }
  };
  if(cfg.gif) embed.image = { url: cfg.gif };

  channel.send({ embeds: [embed] }).catch(console.error);
});

/* =========================
   GOODBYE EVENT
========================= */
client.on("guildMemberRemove", async member => {
  const cfg = config[member.guild.id]?.goodbye;
  if(!cfg) return;

  const channel = await member.guild.channels.fetch(cfg.channel).catch(() => null);
  if(!channel) return;

  let color = parseInt(cfg.color.replace("#",""),16);
  if(isNaN(color)) color = 0xff5555;

  const embed = {
    color,
    title: `👋 Goodbye`,
    description: cfg.message.replace("{user}", member.user.tag).replace("{server}", member.guild.name)
  };
  if(cfg.gif) embed.image = { url: cfg.gif };

  channel.send({ embeds: [embed] }).catch(console.error);
});

/* =========================
   READY
========================= */
client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);

/* =========================
   KEEP BOT ONLINE 24/7
========================= */
setInterval(() => {
  console.log("🟢 Keep-alive ping at " + new Date().toLocaleTimeString());
}, 5 * 60 * 1000);
