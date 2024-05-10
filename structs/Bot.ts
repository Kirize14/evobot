import {
  ApplicationCommandDataResolvable,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  Interaction,
  Message,
  REST,
  Routes,
  Snowflake,
  EmbedBuilder,
  TextChannel
} from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { Command } from "../interfaces/Command";
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";
import { MusicQueue } from "./MusicQueue";
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';


export class Bot {
  public readonly prefix = "/";
  public commands = new Collection<string, Command>();
  public slashCommands = new Array<ApplicationCommandDataResolvable>();
  public slashCommandsMap = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();
  public queues = new Collection<Snowflake, MusicQueue>();

  public constructor(public readonly client: Client) {
    this.client.login(config.TOKEN);

    this.client.on("ready", () => {
      console.log(`${this.client.user!.username} ready!`);

      this.registerSlashCommands();
    });

    this.client.on("warn", (info) => console.log(info));
    this.client.on("error", console.error);

    this.onInteractionCreate();
    this.messageCreate();
  }
  private async messageCreate(){
    this.client.on(Events.MessageCreate, async (message: Message<boolean>) => {
      const channelIdToDelete = '1183351533098770453'; // Replace with the source channel ID
      const channelIdToNotify = '1183344141208391780'; // Replace with the target channel ID
      if (message.channel.id === channelIdToDelete && message.attachments.size > 0) {
        // If a message with an attachment is sent in the source channel, delete it
        await message.delete();
    
        // Send a message mentioning the author in the target channel
        const targetChannel = this.client.channels.cache.get(channelIdToNotify);
        if (targetChannel) {
            const userAvatarURL = message.author.displayAvatarURL();
            const attachmentURL = message.attachments.first()!.url;
            const response = await axios.get(attachmentURL, {
              responseType: 'arraybuffer'
          });
          const convertedImage: Buffer = await sharp(response.data).jpeg().toBuffer();
          const outputFileName: string = `converted-${Date.now()}.jpg`;
          const outputPath: string = path.join("/var/www/html/discordPic/", outputFileName);
          fs.writeFileSync(outputPath, convertedImage);
          console.log(`Saved converted image as ${outputFileName}`);
            const embed = new EmbedBuilder()
              .setTitle(`Image sent by ${message.author.tag}`)
              .setDescription(`Sent in ${message.channel}`)
              .setImage(attachmentURL)
              .setThumbnail(userAvatarURL)
              .setColor('#ff99ff');
            (targetChannel as TextChannel).send({ embeds: [embed] });
            (targetChannel as TextChannel).send(`${message.author}`);
            (targetChannel as TextChannel).send(`====================================================`);
          }
        }
    });
    const escapeRegex = (str:any) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cooldowns = new Collection();

  }
  private async registerSlashCommands() {
    const rest = new REST({ version: "9" }).setToken(config.TOKEN);

    const commandFiles = readdirSync(path.join(__dirname, "..", "commands")).filter((file) => !file.endsWith(".map"));

    for (const file of commandFiles) {
      const command = await import(path.join(__dirname, "..", "commands", `${file}`));

      this.slashCommands.push(command.default.data);
      this.slashCommandsMap.set(command.default.data.name, command.default);
    }

    await rest.put(Routes.applicationCommands(this.client.user!.id), { body: this.slashCommands });
  }

  private async onInteractionCreate() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<any> => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.slashCommandsMap.get(interaction.commandName);

      if (!command) return;

      if (!this.cooldowns.has(interaction.commandName)) {
        this.cooldowns.set(interaction.commandName, new Collection());
      }

      const now = Date.now();
      const timestamps = this.cooldowns.get(interaction.commandName)!;
      const cooldownAmount = (command.cooldown || 1) * 1000;

      const timestamp = timestamps.get(interaction.user.id);

      if (timestamp) {
        const expirationTime = timestamp + cooldownAmount;

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({
            content: i18n.__mf("common.cooldownMessage", {
              time: timeLeft.toFixed(1),
              name: interaction.commandName
            }),
            ephemeral: true
          });
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        const permissionsCheck: PermissionResult = await checkPermissions(command, interaction);

        if (permissionsCheck.result) {
          command.execute(interaction as ChatInputCommandInteraction);
        } else {
          throw new MissingPermissionsException(permissionsCheck.missing);
        }
      } catch (error: any) {
        console.error(error);

        if (error.message.includes("permissions")) {
          interaction.reply({ content: error.toString(), ephemeral: true }).catch(console.error);
        } else {
          interaction.reply({ content: i18n.__("common.errorCommand"), ephemeral: true }).catch(console.error);
        }
      }
    });
  }
}
