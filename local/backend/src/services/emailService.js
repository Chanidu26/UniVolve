// Local: mailhog / console fallback
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailhog',
  port: process.env.SMTP_PORT || 1025,
  secure: false,
});

exports.sendStatusEmail = async (to, eventTitle, roleName, status) => {
  try {
    await transport.sendMail({
      from: 'noreply@vms.local',
      to,
      subject: `Application ${status}: ${eventTitle}`,
      html: `<p>Your application for <b>${roleName}</b> at <b>${eventTitle}</b> has been <b>${status}</b>.</p>`,
    });
  } catch (e) {
    console.error('Email send failed (non-fatal):', e.message);
  }
};
