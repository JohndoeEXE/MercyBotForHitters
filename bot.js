const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ] 
});

// Storage for bot data
let botData = {
    mercyMessage: "Please show mercy!",
    mercyRoleId: null,
    giveaways: {}
};

// Load data from file if exists (Railway compatible)
try {
    if (fs.existsSync('botdata.json')) {
        const data = fs.readFileSync('botdata.json', 'utf8');
        if (data.trim()) {
            botData = JSON.parse(data);
        }
    }
} catch (error) {
    console.log('Could not load botdata.json, using defaults:', error.message);
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync('botdata.json', JSON.stringify(botData, null, 2));
        console.log('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

client.once('ready', async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🎯 Bot is in ${client.guilds.cache.size} servers`);
    
    // Set bot status
    client.user.setActivity('Giveaways & Mercy', { type: 'WATCHING' });
    
    await registerCommands();
});

// Register slash commands
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Start a giveaway')
            .addStringOption(option =>
                option.setName('prize')
                    .setDescription('What is the prize?')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('duration')
                    .setDescription('Duration in minutes')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10080))
            .addStringOption(option =>
                option.setName('winner')
                    .setDescription('Rig the winner (user ID or mention)')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('mercyspeech')
            .setDescription('Set the mercy speech message')
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The mercy speech text')
                    .setRequired(true)
                    .setMaxLength(2000)),

        new SlashCommandBuilder()
            .setName('mercy')
            .setDescription('Send the mercy speech with clickable button'),

        new SlashCommandBuilder()
            .setName('mercyrole')
            .setDescription('Set the role given when mercy button is clicked')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to assign')
                    .setRequired(true))
    ];

    try {
        console.log('🔄 Refreshing application (/) commands...');
        await client.application.commands.set(commands);
        console.log('✅ Successfully registered application commands.');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
        }
    }
});

async function handleSlashCommand(interaction) {
    const { commandName, options } = interaction;

    console.log(`Command used: ${commandName} by ${interaction.user.tag}`);

    switch (commandName) {
        case 'giveaway':
            await handleGiveaway(interaction);
            break;
        case 'mercyspeech':
            await handleMercySpeech(interaction);
            break;
        case 'mercy':
            await handleMercy(interaction);
            break;
        case 'mercyrole':
            await handleMercyRole(interaction);
            break;
        default:
            await interaction.reply({ content: 'Unknown command!', ephemeral: true });
    }
}

async function handleGiveaway(interaction) {
    const prize = interaction.options.getString('prize');
    const duration = interaction.options.getInteger('duration');
    const riggedWinner = interaction.options.getString('winner');

    const giveawayId = Date.now().toString();
    
    const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(`**Prize:** ${prize}\n**Duration:** ${duration} minutes\n\nClick the 🎉 button below to enter!`)
        .setColor('#FFD700')
        .setTimestamp(new Date(Date.now() + duration * 60000))
        .setFooter({ text: 'Ends at' });

    const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_${giveawayId}`)
                .setLabel('Enter Giveaway')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary)
        );

    const message = await interaction.reply({ embeds: [embed], components: [button], fetchReply: true });

    // Store giveaway data
    botData.giveaways[giveawayId] = {
        messageId: message.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        prize: prize,
        duration: duration,
        riggedWinner: riggedWinner,
        participants: [],
        endTime: Date.now() + duration * 60000,
        ended: false
    };

    saveData();

    // Set timeout to end giveaway
    setTimeout(() => endGiveaway(giveawayId), duration * 60000);
    
    console.log(`Giveaway started: ${prize} for ${duration} minutes`);
}

async function handleMercySpeech(interaction) {
    const message = interaction.options.getString('message');
    botData.mercyMessage = message;
    saveData();
    
    await interaction.reply({ 
        content: `✅ Mercy speech updated to: "${message.length > 100 ? message.substring(0, 100) + '...' : message}"`, 
        ephemeral: true 
    });
    
    console.log(`Mercy speech updated by ${interaction.user.tag}`);
}

async function handleMercy(interaction) {
    if (!botData.mercyRoleId) {
        return interaction.reply({ content: '❌ No mercy role has been set! Use /mercyrole first.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('🙏 Mercy')
        .setDescription(botData.mercyMessage)
        .setColor('#00FF00')
        .setTimestamp();

    const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('mercy_accept')
                .setLabel('Accept Mercy')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({ embeds: [embed], components: [button] });
    console.log(`Mercy message sent by ${interaction.user.tag}`);
}

async function handleMercyRole(interaction) {
    const role = interaction.options.getRole('role');
    
    // Check if bot can assign this role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ 
            content: '❌ I cannot assign this role because it is higher than or equal to my highest role!', 
            ephemeral: true 
        });
    }
    
    botData.mercyRoleId = role.id;
    saveData();
    
    await interaction.reply({ content: `✅ Mercy role set to: ${role.name}`, ephemeral: true });
    console.log(`Mercy role set to ${role.name} by ${interaction.user.tag}`);
}

async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('giveaway_')) {
        const giveawayId = customId.split('_')[1];
        const giveaway = botData.giveaways[giveawayId];

        if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: '❌ This giveaway has ended!', ephemeral: true });
        }

        if (giveaway.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ You are already entered in this giveaway!', ephemeral: true });
        }

        giveaway.participants.push(interaction.user.id);
        saveData();

        await interaction.reply({ content: '✅ You have entered the giveaway! Good luck! 🍀', ephemeral: true });
        console.log(`${interaction.user.tag} entered giveaway: ${giveaway.prize}`);

    } else if (customId === 'mercy_accept') {
        if (!botData.mercyRoleId) {
            return interaction.reply({ content: '❌ No mercy role configured!', ephemeral: true });
        }

        try {
            const role = interaction.guild.roles.cache.get(botData.mercyRoleId);
            if (!role) {
                return interaction.reply({ content: '❌ Mercy role not found!', ephemeral: true });
            }

            const member = interaction.member;
            if (member.roles.cache.has(botData.mercyRoleId)) {
                return interaction.reply({ content: '❌ You already have the mercy role!', ephemeral: true });
            }

            await member.roles.add(role);
            await interaction.reply({ content: `✅ You have been granted the **${role.name}** role!`, ephemeral: true });
            console.log(`${interaction.user.tag} received mercy role: ${role.name}`);
        } catch (error) {
            console.error('Error giving mercy role:', error);
            await interaction.reply({ content: '❌ Failed to give you the role. Check bot permissions.', ephemeral: true });
        }
    }
}

async function endGiveaway(giveawayId) {
    const giveaway = botData.giveaways[giveawayId];
    if (!giveaway || giveaway.ended) return;

    giveaway.ended = true;
    
    let winner;
    if (giveaway.riggedWinner) {
        // Use rigged winner
        const userId = giveaway.riggedWinner.replace(/[<@!>]/g, '');
        winner = userId;
    } else if (giveaway.participants.length > 0) {
        // Random winner
        winner = giveaway.participants[Math.floor(Math.random() * giveaway.participants.length)];
    }

    try {
        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) {
            console.error('Channel not found for giveaway:', giveawayId);
            return;
        }

        const message = await channel.messages.fetch(giveaway.messageId);

        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n${winner ? `**Winner:** <@${winner}>\n**Participants:** ${giveaway.participants.length}` : 'No participants, no winner!'}`)
            .setColor('#FF0000')
            .setTimestamp();

        // Disable the button
        const disabledButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_${giveawayId}`)
                    .setLabel('Giveaway Ended')
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        await message.edit({ embeds: [embed], components: [disabledButton] });

        if (winner) {
            await channel.send(`🎉 Congratulations <@${winner}>! You won **${giveaway.prize}**!`);
        } else {
            await channel.send(`😢 No one entered the giveaway for **${giveaway.prize}**.`);
        }

        console.log(`Giveaway ended: ${giveaway.prize} - Winner: ${winner || 'None'}`);
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }

    saveData();
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('🔄 Received SIGINT. Saving data and shutting down gracefully...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔄 Received SIGTERM. Saving data and shutting down gracefully...');
    saveData();
    process.exit(0);
});

// Error handling
client.on('error', error => {
    console.error('Client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Get token from environment variable
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN environment variable is required!');
    console.error('Please set it in Railway dashboard under Variables tab.');
    process.exit(1);
}

console.log('🚀 Starting Discord bot...');
console.log('📡 Connecting to Discord...');

client.login(TOKEN).catch(error => {
    console.error('❌ Failed to login:', error.message);
    process.exit(1);
});
