Discord Giveaway & Mercy Bot
A Discord bot with giveaway management and mercy role assignment features.

Features
Giveaways: Create giveaways with optional winner rigging
Mercy System: Set custom mercy messages with role assignment
Slash Commands: Modern Discord slash command integration
Data Persistence: Settings saved between restarts
Commands
/giveaway
Start a new giveaway

prize - What you're giving away (required)
duration - Duration in minutes (required)
winner - Rig the winner by providing user ID/mention (optional)
/mercyspeech
Set the mercy message text

message - The text to display (required)
/mercy
Display the mercy message with clickable button to assign role

/mercyrole
Set which role gets assigned when mercy button is clicked

role - The role to assign (required)
Setup
Install Dependencies
bash
npm install
Bot Configuration
Create a Discord application at https://discord.com/developers/applications
Create a bot and copy the token
Replace 'YOUR_BOT_TOKEN' in bot.js with your actual token
Bot Permissions Your bot needs these permissions:
Send Messages
Use Slash Commands
Manage Roles
Read Message History
Embed Links
Run the Bot
bash
npm start
File Structure
discord-bot/
├── bot.js          # Main bot code
├── package.json    # Project dependencies
├── README.md       # This file
├── .gitignore      # Git ignore rules
└── botdata.json    # Bot data (auto-generated)
Security Notes
Never commit your bot token to GitHub
Keep your .env file in .gitignore
Consider using environment variables for the token
Contributing
Fork the repository
Create a feature branch
Make your changes
Submit a pull request
License
MIT License - feel free to use and modify as needed!

