/**
 * KeyAuth Discord Bot
 * Management bot for KeyAuth applications
 */

import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js'
import dotenv from 'dotenv'
import { KeyAuthClient } from './keyauth.js'

dotenv.config()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
})

const keyAuth = new KeyAuthClient()

// Admin IDs from environment variable
const adminIds = (process.env.ADMIN_IDS || '').split(',').map((id: string) => id.trim()).filter(Boolean)

function isAdmin(userId: string): boolean {
  return adminIds.includes(userId)
}

// Command definitions
const commands = [
  // User Management
  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Get user information')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to look up')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to ban')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to unban')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('deleteuser')
    .setDescription('Delete a user account')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to delete')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('resethwid')
    .setDescription('Reset a user\'s HWID')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to reset HWID for')
        .setRequired(true)
    ),

  // License Management
  new SlashCommandBuilder()
    .setName('createlicense')
    .setDescription('Create a new license key')
    .addStringOption((option: any) =>
      option.setName('license')
        .setDescription('The license key to create')
        .setRequired(true)
    )
    .addIntegerOption((option: any) =>
      option.setName('days')
        .setDescription('Number of days for the license')
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('deletelicense')
    .setDescription('Delete a license key')
    .addStringOption((option: any) =>
      option.setName('license')
        .setDescription('The license key to delete')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('uselicense')
    .setDescription('Use a license key for a user')
    .addStringOption((option: any) =>
      option.setName('license')
        .setDescription('The license key to use')
        .setRequired(true)
    )
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username to apply the license to')
        .setRequired(true)
    ),

  // Subscription Management
  new SlashCommandBuilder()
    .setName('extendsub')
    .setDescription('Extend a user\'s subscription')
    .addStringOption((option: any) =>
      option.setName('username')
        .setDescription('The username')
        .setRequired(true)
    )
    .addStringOption((option: any) =>
      option.setName('subscription')
        .setDescription('The subscription name')
        .setRequired(true)
    )
    .addIntegerOption((option: any) =>
      option.setName('days')
        .setDescription('Number of days to extend')
        .setRequired(true)
        .setMinValue(1)
    ),

  // Statistics
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Get application statistics'),

].map(command => command.toJSON())

// Register commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)

  try {
    console.log('Started refreshing application (/) commands.')

    if (process.env.GUILD_ID) {
      // Register commands for a specific guild (faster for testing)
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.GUILD_ID!),
        { body: commands },
      )
      console.log(`Successfully registered ${commands.length} guild commands.`)
    } else {
      // Register commands globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands },
      )
      console.log(`Successfully registered ${commands.length} global commands.`)
    }
  } catch (error) {
    console.error('Error registering commands:', error)
  }
}

// Create embed helper
function createEmbed(title: string, description: string, color: number = 0x5865F2): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  // Check if user is admin
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({
      embeds: [createEmbed('❌ Access Denied', 'You do not have permission to use this bot.', 0xFF0000)],
      ephemeral: true,
    })
    return
  }

  const { commandName } = interaction

  try {
    switch (commandName) {
      case 'user': {
        const username = interaction.options.getString('username', true)?.trim()
        if (!username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.getUserInfo(username)

        if (result.success && result.info) {
          const info = result.info
          const embed = createEmbed(`👤 User: ${username}`, '')
            .addFields(
              { name: 'Username', value: info.username || 'N/A', inline: true },
              { name: 'IP Address', value: info.ip || 'N/A', inline: true },
              { name: 'HWID', value: info.hwid || 'N/A', inline: true },
              { name: 'Created', value: info.createdate ? new Date(info.createdate).toLocaleDateString() : 'N/A', inline: true },
              { name: 'Last Login', value: info.lastlogin ? new Date(info.lastlogin).toLocaleDateString() : 'N/A', inline: true },
            )

          if (info.subscriptions && Array.isArray(info.subscriptions) && info.subscriptions.length > 0) {
            const subs = info.subscriptions.map((sub: any) =>
              `**${sub.subscription}**\nKey: ${sub.key}\nExpiry: ${new Date(sub.expiry).toLocaleDateString()}`
            ).join('\n\n')
            embed.addFields({ name: 'Subscriptions', value: subs || 'None' })
          }

          await interaction.reply({ embeds: [embed] })
        } else {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', result.message || 'User not found', 0xFF0000)],
          })
        }
        break
      }

      case 'ban': {
        const username = interaction.options.getString('username', true)?.trim()
        if (!username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.banUser(username)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ User Banned' : '❌ Error',
            result.message || (result.success ? `User ${username} has been banned.` : 'Failed to ban user'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'unban': {
        const username = interaction.options.getString('username', true)?.trim()
        if (!username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.unbanUser(username)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ User Unbanned' : '❌ Error',
            result.message || (result.success ? `User ${username} has been unbanned.` : 'Failed to unban user'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'deleteuser': {
        const username = interaction.options.getString('username', true)?.trim()
        if (!username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.deleteUser(username)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ User Deleted' : '❌ Error',
            result.message || (result.success ? `User ${username} has been deleted.` : 'Failed to delete user'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'resethwid': {
        const username = interaction.options.getString('username', true)?.trim()
        if (!username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.resetHWID(username)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ HWID Reset' : '❌ Error',
            result.message || (result.success ? `HWID for ${username} has been reset.` : 'Failed to reset HWID'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'createlicense': {
        const license = interaction.options.getString('license', true)
        const days = interaction.options.getInteger('days', true)
        const result = await keyAuth.createLicense(license, days)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ License Created' : '❌ Error',
            result.message || (result.success ? `License ${license} created for ${days} days.` : 'Failed to create license'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'deletelicense': {
        const license = interaction.options.getString('license', true)
        const result = await keyAuth.deleteLicense(license)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ License Deleted' : '❌ Error',
            result.message || (result.success ? `License ${license} has been deleted.` : 'Failed to delete license'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'uselicense': {
        const license = interaction.options.getString('license', true)?.trim()
        const username = interaction.options.getString('username', true)?.trim()
        if (!license || !username) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'License and username cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.useLicense(license, username)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ License Applied' : '❌ Error',
            result.message || (result.success ? `License ${license} applied to ${username}.` : 'Failed to apply license'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'extendsub': {
        const username = interaction.options.getString('username', true)?.trim()
        const subscription = interaction.options.getString('subscription', true)?.trim()
        const days = interaction.options.getInteger('days', true)
        if (!username || !subscription) {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', 'Username and subscription cannot be empty', 0xFF0000)],
            ephemeral: true,
          })
          return
        }
        const result = await keyAuth.extendSubscription(username, subscription, days)

        await interaction.reply({
          embeds: [createEmbed(
            result.success ? '✅ Subscription Extended' : '❌ Error',
            result.message || (result.success ? `Subscription ${subscription} for ${username} extended by ${days} days.` : 'Failed to extend subscription'),
            result.success ? 0x00FF00 : 0xFF0000
          )],
        })
        break
      }

      case 'stats': {
        const result = await keyAuth.getStats()

        if (result.success && result.info) {
          const stats = result.info
          const embed = createEmbed('📊 Application Statistics', '')
            .addFields(
              { name: 'Total Users', value: stats.users?.toString() || '0', inline: true },
              { name: 'Total Licenses', value: stats.licenses?.toString() || '0', inline: true },
              { name: 'Online Users', value: stats.online?.toString() || '0', inline: true },
            )

          await interaction.reply({ embeds: [embed] })
        } else {
          await interaction.reply({
            embeds: [createEmbed('❌ Error', result.message || 'Failed to fetch statistics', 0xFF0000)],
          })
        }
        break
      }

      default:
        await interaction.reply({
          embeds: [createEmbed('❌ Unknown Command', 'This command is not implemented.', 0xFF0000)],
          ephemeral: true,
        })
    }
  } catch (error: any) {
    console.error('Error handling command:', error)
    await interaction.reply({
      embeds: [createEmbed('❌ Error', `An error occurred: ${error.message}`, 0xFF0000)],
      ephemeral: true,
    })
  }
})

// Bot ready event
client.once('ready', () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user?.tag}`)
})

// Start bot
async function start() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN environment variable is required')
    }
    if (!process.env.DISCORD_CLIENT_ID) {
      throw new Error('DISCORD_CLIENT_ID environment variable is required')
    }

    await registerCommands()
    await client.login(process.env.DISCORD_TOKEN)
  } catch (error) {
    console.error('Failed to start bot:', error)
    process.exit(1)
  }
}

start()

