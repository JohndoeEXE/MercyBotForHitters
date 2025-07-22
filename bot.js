
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

// Load data from file if exists
try {
    if (fs.existsSync('botdata.json')) {
        botData = JSON.parse(fs.readFileSync('botdata.json', 'utf8'));
    }
} catch (error) {
    console.log('Could not load botdata.json, using defaults');
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync('botdata.json', JSON.stringify(botData, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

client.once('ready', () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    registerCommands();
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
                    .setRequired(true))
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
                    .setRequired(true)),

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
        console.log('Refreshing application (/) commands...');
        await client.application.commands.set(commands);
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    }
});

async function handleSlashCommand(interaction) {
    const { commandName, options } = interaction;

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
}

async function handleMercySpeech(interaction) {
    const message = interaction.options.getString('message');
    botData.mercyMessage = message;
    saveData();
    
    await interaction.reply({ content: `Mercy speech updated to: "${message}"`, ephemeral: true });
}

async function handleMercy(interaction) {
    if (!botData.mercyRoleId) {
        return interaction.reply({ content: 'No mercy role has been set! Use /mercyrole first.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('Mercy')
        .setDescription(botData.mercyMessage)
        .setColor('#00FF00');

    const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('mercy_accept')
                .setLabel('Accept')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({ embeds: [embed], components: [button] });
}

async function handleMercyRole(interaction) {
    const role = interaction.options.getRole('role');
    botData.mercyRoleId = role.id;
    saveData();
    
    await interaction.reply({ content: `Mercy role set to: ${role.name}`, ephemeral: true });
}

async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('giveaway_')) {
        const giveawayId = customId.split('_')[1];
        const giveaway = botData.giveaways[giveawayId];

        if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: 'This giveaway has ended!', ephemeral: true });
        }

        if (giveaway.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You are already entered in this giveaway!', ephemeral: true });
        }

        giveaway.participants.push(interaction.user.id);
        saveData();

        await interaction.reply({ content: 'You have entered the giveaway! Good luck! 🍀', ephemeral: true });

    } else if (customId === 'mercy_accept') {
        if (!botData.mercyRoleId) {
            return interaction.reply({ content: 'No mercy role configured!', ephemeral: true });
        }

        try {
            const role = interaction.guild.roles.cache.get(botData.mercyRoleId);
            if (!role) {
                return interaction.reply({ content: 'Mercy role not found!', ephemeral: true });
            }

            const member = interaction.member;
            if (member.roles.cache.has(botData.mercyRoleId)) {
                return interaction.reply({ content: 'You already have the mercy role!', ephemeral: true });
            }

            await member.roles.add(role);
            await interaction.reply({ content: `You have been granted the ${role.name} role!`, ephemeral: true });
        } catch (error) {
            console.error('Error giving mercy role:', error);
            await interaction.reply({ content: 'Failed to give you the role. Check bot permissions.', ephemeral: true });
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
        const message = await channel.messages.fetch(giveaway.messageId);

        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n${winner ? `**Winner:** <@${winner}>` : 'No participants, no winner!'}`)
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
        }
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }

    saveData();
}

// Use environment variable for token (Railway compatible)
const TOKEN = process.env.DISCORD_TOKEN || 'MTM5NjcxMjU4MTE2MjQ3MTQ5Nw.GesYCu.AXxjD9X-SPpiXXAsrfM16VLB-5bnMbR0SLgp74';

if (TOKEN === 'YOUR_BOT_TOKEN') {
    console.error('Please set DISCORD_TOKEN environment variable');
    process.exit(1);
}

client.login(TOKEN);
