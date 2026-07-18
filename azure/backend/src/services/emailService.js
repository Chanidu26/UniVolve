const { EmailClient } = require('@azure/communication-email');

const client = process.env.ACS_CONNECTION_STRING
  ? new EmailClient(process.env.ACS_CONNECTION_STRING)
  : null;

exports.sendStatusEmail = async (to, eventTitle, roleName, status) => {
  if (!client) return console.warn('ACS not configured; skipping email');
  try {
    const poller = await client.beginSend({
      senderAddress: process.env.ACS_SENDER,   // e.g. DoNotReply@<domain>.azurecomm.net
      content: {
        subject: `Application ${status}: ${eventTitle}`,
        html: `<p>Your application for <b>${roleName}</b> at <b>${eventTitle}</b> has been <b>${status}</b>.</p>`,
      },
      recipients: { to: [{ address: to }] },
    });
    await poller.pollUntilDone();
  } catch (e) { console.error('ACS email failed (non-fatal):', e.message); }
};
