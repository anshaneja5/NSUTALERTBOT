const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { MongoClient } = require('mongodb');
const { DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;
const specialCharsRegex = /[\/|.:"\s-]/g;
const env = require('dotenv').config();

const express = require('express');
const app = express();
const port = 8000; 

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

let waSocket;

async function connectionLogic() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth-info-baileys");
        waSocket = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            defaultQueryTimeoutMs:0,
            keepAliveIntervalMs: 10000,
            connectTimeoutMs:60000,
            syncFullHistory:true,
            markOnlineOnConnect:true,
            emitOwnEvents:true,
        });

        waSocket.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update || {};

            if (qr) {
                console.log(qr);
            }

            if (connection === "close") {
                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    await connectionLogic();
                }
            }
        });
        waSocket.ev.on("creds.update", saveCreds);

        //this is the code to find the groupid
        //     waSocket.ev.on("messages.upsert", (chatUpdate) => {
        //         msg = chatUpdate.messages[0]
        //         console.log(msg.key.remoteJid)
        // });
    } catch (error) {
        console.error('Error in connectionLogic:', error);
    }
}

async function sendWhatsAppMessageWhenPDF(message, path,notificationText) {
    try {
        if (!waSocket) {
            console.log('Socket connection not established. Message not sent.');
            return;
        }
        const id = process.env.GROUP_ID;
        console.log("id",id);
        await waSocket.sendMessage(id, { text: message });
            await waSocket.sendMessage(id, {
                document: fs.readFileSync(path),
                mimetype: 'application/pdf',
                fileName: `${notificationText}`
            });
        fs.unlink(path, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('File deleted successfully');
        });
        console.log("WhatsApp messages sent successfully!");
    } catch (error) {
        console.log("Error sending WhatsApp messages:", error);
    }
}

async function sendWhatsAppMessageWhenDrive(message) {
    try {
        if (!waSocket) {
            console.log('Socket connection not established. Message not sent.');
            return;
        }
        const id = process.env.GROUP_ID;
        await waSocket.sendMessage(id, { text: message });
        console.log("WhatsApp messages sent successfully!");
    } catch (error) {
        console.log("Error sending WhatsApp messages:", error);
    }
}


async function connectToMongoDB() {
    const uri = process.env.URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client;
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

// Function to close MongoDB connection
async function closeMongoDBConnection(client) {
    try {
        await client.close();
        console.log("MongoDB connection closed");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
        throw error;
    }
}

// Function to insert a new notification into MongoDB
async function insertNotification(client, notification,href) {
    try {
        const dbName = "notificationsDB";
        const collectionName = "notifications";
        const db = client.db(dbName);
        const notificationsCollection = db.collection(collectionName);

        if(notification.path != ''){
            const message = `📢 New Notice Alert 🚨\n📅 Date: ${notification.date}\n🍀 ${notification.notificationPublishedBy}\n\n💫 Notification: ${notification.notificationText}`;
            sendWhatsAppMessageWhenPDF(message,notification.path,notification.notificationText);
            await notificationsCollection.insertOne(notification);
        console.log("Notification inserted into MongoDB:", notification);
        }
        else{
            const message = `📢 New Notice Alert 🚨\n📅 Date: ${notification.date}\n🍀 ${notification.notificationPublishedBy}\n\n💫 Notification: ${notification.notificationText}\nLink: ${href}`;
            sendWhatsAppMessageWhenDrive(message);
            await notificationsCollection.insertOne(notification);
        console.log("Notification inserted into MongoDB:", notification);
        }
    } catch (error) {
        console.error("Error inserting notification into MongoDB:", error);
        throw error;
    }
}

async function downloadFile(client, notificationText, notificationPublishedBy, date) {
    try {
        const response = await axios.get('https://www.imsnsit.org/imsnsit/notifications.php', {
            headers: {
                Cookie: process.env.COOKIE, // Include cookie in the request headers
                Referer: 'https://www.imsnsit.org/imsnsit/notifications.php' // Include referer in the request headers
            }
        });
        const html = response.data;

        const $ = cheerio.load(html);

        // Find all anchor tags containing the specified notification text
        const anchorTag = $('a font').filter(function() {
            return $(this).text().trim().includes(notificationText);
        }).closest('a'); // Select the parent <a> tag        
        // Iterate through each anchor tag
        anchorTag.each(async (index, element) => {
            const href = $(element).attr('href');
            if (href && href.includes('plum_url')) {
                try {
                    const filePath = await downloadPDF(href,notificationText);
                    // Insert notification into MongoDB with file path
                    const notification = {
                        date: date,
                        notificationPublishedBy,
                        notificationText,
                        path: filePath,
                    };
                    await insertNotification(client, notification, "");
                    console.log(`File saved at: ${filePath}`);
                } catch (error) {
                    console.error("Error downloading PDF:", error);
                }
            }else if((href && href.includes('drive.google.com')) || (href && href.includes('docs.google.com')) ){
                const notification = {
                    date: date,
                    notificationPublishedBy,
                    notificationText,
                    path: ""
                };
                await insertNotification(client, notification, href);
            }
        });
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

async function downloadPDF(url,notificationText) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
            Cookie: process.env.COOKIE, // Include cookie in the request headers
            Referer: 'https://www.imsnsit.org/imsnsit/notifications.php' // Include referer in the request headers
        }
    });
    // const uniqueId = uuidv4();
    notificationText = notificationText.replace(specialCharsRegex, '');
    // Extract the file name from the URL
    const fileName = `${notificationText}.pdf`;
    // Specify the download directory
    const downloadDir = path.join(__dirname, 'notice');

    // Create the directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
    }

    // Specify the file path
    const filePath = path.join(downloadDir, fileName);

    // Write the stream to the file
    response.data.pipe(fs.createWriteStream(filePath));

    // Return the file path
    return new Promise((resolve, reject) => {
        response.data.on('end', () => {
            resolve(filePath);
        });

        response.data.on('error', (error) => {
            reject(error);
        });
    });
}

async function scrapeNotifications() {
    const client = await connectToMongoDB();

    try {
        const response = await axios.get('https://www.imsnsit.org/imsnsit/notifications.php');
        const html = response.data;

        const $ = cheerio.load(html);

        // Select each table row (notification) from the desired table
        $('form > table[width="80%"] tbody tr').each(async (index, element) => {
            const date = $(element).find('td:first-child font').text().trim();
            const notificationPublishedBy = $(element).find('td:nth-child(2) font').last().text().trim();
            const notificationText = $(element).find('td:nth-child(2) font').first().text().trim();
            const notificationLink = $(element).find('td:nth-child(2) a').attr('href');

            // Check if notification has all necessary details
            if (date && notificationPublishedBy && notificationText && notificationLink) {
                // Check if the notification already exists in the database
                const existingNotification = await client.db("notificationsDB").collection("notifications").findOne({
                    date: date,
                    notificationPublishedBy: notificationPublishedBy,
                    notificationText: notificationText,
                });

                // If the notification doesn't exist, add it to the database
                if (!existingNotification) {
                    // Push download promise to array
                    downloadFile(client, notificationText, notificationPublishedBy, date);
                }
            }
        });
    } catch (error) {
        console.error('Error scraping notifications:', error);
    } finally {
        // Close MongoDB connection
        // await client.close();
    }
}


connectionLogic();

// Schedule scraping task every 60 minutes
const scrapingJob = schedule.scheduleJob('*/60 * * * *', () => {
    console.log('Scraping for new notifications...');
    scrapeNotifications();
});

// Schedule scraping task every 30 seconds, I used this for testing
// const scrapingJob = schedule.scheduleJob('*/30 * * * * *', () => {
//     console.log('Scraping for new notifications...');
//     scrapeNotifications();
// });