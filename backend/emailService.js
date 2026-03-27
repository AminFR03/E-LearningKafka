const nodemailer = require('nodemailer');

async function sendEmailNotification(to, subject, text) {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn(`⚠️ Cannot send real email to ${to}: EMAIL_USER or EMAIL_PASS not set in .env!`);
            return;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        let info = await transporter.sendMail({
            from: `"Kafka E-Learning" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text,
        });

        console.log("Real Email sent successfully! Message ID: %s", info.messageId);
    } catch (error) {
        console.error("Failed to send real email", error);
    }
}

module.exports = { sendEmailNotification };
