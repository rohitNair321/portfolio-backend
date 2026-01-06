const { supabase } = require('../db/supabaseClient');
const nodemailer = require('nodemailer');
const axios = require('axios');

//#region Submit Contact Form
async function submitContactForm(req, res) {
  try {
    const { firstName, lastName, email, message } = req.body;

    if (!firstName || !email || !message) {
      return res.status(400).json({ message: 'Missing fields.' });
    }

    const { error: dbError } = await supabase
      .from('contact_messages')
      .insert([{ first_name: firstName, last_name: lastName, email, message }]);

    if (dbError) throw dbError;

    // 2. Send Email (SMTP)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: {
        family: 4, // Forces IPv4
        rejectUnauthorized: false
      },
      // Add these timeout settings to give Render more time to connect
      connectionTimeout: 10000, // 10 seconds
      socketTimeout: 10000,
      greetingTimeout: 10000,
    });

    transporter.verify((error, success) => {
      if (error) {
        console.log('❌ SMTP Connection Error:');
        console.error(error);
      } else {
        console.log('✅ Mail server connection is successful! Ready to send emails.');
      }
    });

    await transporter.sendMail({
      from: `"Contact" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `New Message from ${firstName} ${lastName}`,
      // text: `From: ${firstName} ${lastName}\nEmail: ${email}\n\nMessage: ${message}`,
      html: `
          <p>Dear Rohit Nair,</p>
          <p>You have received a new message from your portfolio website.</p>
          <p> ${firstName} ${lastName} has sent a message to you.</p>
          <p>Message: ${message}</p>
        `,
    });

    // 3. Fast2SMS Integration (Indian SMS Service)
    if (process.env.ENABLE_SMS === 'true') {
      const smsText = `New Message from ${firstName}: ${message.substring(0, 50)}`;

      const options = {
        method: 'POST',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          "route": "q", // 'q' for Quick SMS
          "message": smsText,
          "language": "english",
          "flash": 0,
          "numbers": process.env.MY_MOBILE_NUMBER,
        }
      };

      await axios(options);
    }

    return res.status(200).json({ message: 'Message sent successfully.' });

  } catch (error) {
    console.error('Contact Error:', error.response?.data || error);
    return res.status(500).json({ message: 'Error processing contact request.' });
  }
}
//#endregion

//#region Get Notifications 
async function getNotifications(req, res) {
  try {
    const response = await fetchFormattedNotifications();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Mark Notification as Read
async function markAsRead(req, res) {
  const { id } = req.params;

  try {
    // 1. Update the specific message
    const { error: updateError } = await supabase
      .from('contact_messages')
      .update({ is_read: true })
      .eq('id', id);

    if (updateError) throw updateError;

    // 2. Fetch the updated list using the helper
    const updatedData = await fetchFormattedNotifications();

    // 3. Return the full updated state
    return res.status(200).json(updatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Helper to fetch and format notifications
async function fetchFormattedNotifications() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    success: true,
    notificationList: data,
    unreadCount: data.filter(m => !m.is_read).length
  };
}
// #endregion

module.exports = { submitContactForm, getNotifications, markAsRead };