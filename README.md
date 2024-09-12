# Notification Bot

## Overview
This Notification Bot is designed to scrape notifications from https://imsnsit.org/imsnsit/notifications.php , store them in a MongoDB database, and send alerts via WhatsApp. It's particularly useful for staying updated with important announcements or notices without manual checking.

![image](https://github.com/user-attachments/assets/328677bf-aef5-4f9a-8fd8-5212770db5c8)

## Features
- Web scraping of notifications from a target website
- MongoDB integration for storing notification data
- WhatsApp messaging for real-time alerts
- Automated PDF download and sharing
- Scheduled scraping at regular intervals
- Express server for potential API endpoints

## Technologies Used
- Node.js
- Express.js
- MongoDB
- WhatsApp Web API (via @whiskeysockets/baileys)
- Cheerio for web scraping
- Axios for HTTP requests
- node-schedule for job scheduling

## Prerequisites
- Node.js (v12 or later recommended)
- MongoDB instance
- WhatsApp account for the bot

## Setup
1. Clone the repository:
   ```
   git clone https://github.com/anshaneja5/NSUTALERTBOT.git
   cd NSUTALERTBOT
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   URI=your_mongodb_uri
   GROUP_ID=your_whatsapp_group_id
   COOKIE=your_website_cookie
   ```

4. Run the bot:
   ```
   node index.js
   ```

## Configuration
- Scraping interval: Modify the `schedule.scheduleJob()` call in `index.js` to change how often the bot checks for new notifications.

## WhatsApp Setup
1. Run the bot for the first time.
2. Scan the QR code printed in the console with your WhatsApp account.
3. The bot will now be connected to your WhatsApp account.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer
This bot is for educational purposes only. Ensure you have permission to scrape the target website and comply with all relevant terms of service and legal requirements.

