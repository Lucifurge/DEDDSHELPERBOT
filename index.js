require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const axios = require("axios");
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
app.get("/", (req, res) => {
  console.log(`Ping at ${new Date().toLocaleTimeString()}`);
  res.send("Community bot is alive");
});
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Express server running");
});

/* =========================
   DISCORD CLIENT
========================= */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* =========================
   START TIME
========================= */
const startTime = Date.now();

/* =========================
   STORAGE FILE
========================= */
const memeFile = path.join(__dirname, "memeChannels.json");

const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {};
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let memeChannels = load(memeFile);

/* =========================
   SAFE API
========================= */
async function safeMeme() {
  try {
    const r = await axios.get("https://meme-api.com/gimme", { timeout: 4000 });
    return r.data;
  } catch {
    return null;
  }
}

/* =========================
   SLASH COMMANDS
========================= */
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot status"),
  new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
  new SlashCommandBuilder().setName("uptime").setDescription("Bot uptime"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get info about a user")
    .addUserOption(o => o.setName("user").setDescription("Select user").setRequired(false)),
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get a user's avatar")
    .addUserOption(o => o.setName("user").setDescription("Select user").setRequired(false)),
  new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin"),
  new SlashCommandBuilder().setName("roll").setDescription("Roll a dice"),
  new SlashCommandBuilder().setName("meme").setDescription("Send a meme"),
  new SlashCommandBuilder()
    .setName("setmemeschannel")
    .setDescription("Set the channel for automatic memes")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel for memes").setRequired(true)
    )
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
    console.error("Command register error:", e);
  }
})();

/* =========================
   COMMAND HANDLER
========================= */
client.on("interactionCreate", async i => {
  if (!i.isCommand()) return;

  try {
    switch (i.commandName) {
      case "ping":
        return i.reply("🟢 Bot Online");

      case "help":
        return i.reply(
          "**📜 Community Commands**\n" +
          "/ping\n/help\n/uptime\n/serverinfo\n/userinfo\n/avatar\n" +
          "/meme\n/coinflip\n/roll\n/setmemeschannel"
        );

      case "uptime":
        return i.reply(`⏱ Uptime: ${Math.floor((Date.now() - startTime) / 1000)}s`);

      case "serverinfo":
        return i.reply(`🏠 ${i.guild.name}\n👥 Members: ${i.guild.memberCount}`);

      case "userinfo": {
        const user = i.options.getUser("user") || i.user;
        return i.reply(`👤 ${user.tag}\n🆔 ${user.id}`);
      }

      case "avatar": {
        const user = i.options.getUser("user") || i.user;
        return i.reply(user.displayAvatarURL({ size: 512 }));
      }

      case "coinflip":
        return i.reply(Math.random() < 0.5 ? "🪙 Heads" : "🪙 Tails");

      case "roll":
        return i.reply(`🎲 Rolled: ${Math.floor(Math.random() * 6) + 1}`);

      case "meme": {
        const m = await safeMeme();
        return i.reply(m ? { content: m.title, files: [m.url] } : "No meme available");
      }

      case "setmemeschannel":
        memeChannels[i.guildId] = i.options.getChannel("channel").id;
        save(memeFile, memeChannels);
        return i.reply("✅ Meme channel set!");
    }
  } catch (e) {
    console.error(e);
    if (!i.replied) i.reply("⚠️ Error handled safely");
  }
});

/* =========================
   BACKGROUND JOB
========================= */
function startJobs() {
  // Memes every 1 hour
  setInterval(async () => {
    for (const g in memeChannels) {
      try {
        const c = await client.channels.fetch(memeChannels[g]);
        const m = await safeMeme();
        if (c && m) {
          c.send({ content: m.title, files: [m.url] });
        }
      } catch (e) {
        console.error("Meme job error:", e);
      }
    }
  }, 60 * 60 * 1000); // 1 hour
}

/* =========================
   READY
========================= */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startJobs();
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
