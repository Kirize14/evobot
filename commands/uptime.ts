import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { i18n } from "../utils/i18n";
import { uptime } from "os";

export default {
  data: new SlashCommandBuilder().setName("uptime").setDescription(i18n.__("uptime.description")),
  execute(interaction: ChatInputCommandInteraction) {
    let seconds = Math.floor(bot.client.uptime! / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    
    let sseconds = Math.floor(Number(uptime));
    let sminutes = Math.floor(sseconds / 60);
    let shours = Math.floor(sminutes / 60);
    let sdays = Math.floor(shours / 24);

    sseconds %= 60;
    sminutes %= 60;
    shours %= 24;
    return interaction
      .reply({ content: i18n.__mf("uptime.result", { days: days, hours: hours, minutes: minutes, seconds: seconds }) + `\nServer uptime \`${sdays} วัน, ${shours} ชั่วโมง, ${sminutes} นาที, ${sseconds} วินาที\`` })
      .catch(console.error);
  }
};
