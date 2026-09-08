const { EmailClient } = require('@azure/communication-email');

const client = process.env.ACS_CONNECTION_STRING
  ? new EmailClient(process.env.ACS_CONNECTION_STRING)
  : null;

const send = async (to, subject, html) => {
  if (!client) return console.warn('ACS not configured; skipping email');
  try {
    const poller = await client.beginSend({
      senderAddress: process.env.ACS_SENDER,   // e.g. DoNotReply@<domain>.azurecomm.net
      content: { subject, html },
      recipients: { to: [{ address: to }] },
    });
    await poller.pollUntilDone();
  } catch (e) { console.error('ACS email failed (non-fatal):', e.message); }
};

exports.sendStatusEmail = (to, eventTitle, roleName, status) => send(
  to,
  `Application ${status}: ${eventTitle}`,
  `<p>Your application for <b>${roleName}</b> at <b>${eventTitle}</b> has been <b>${status}</b>.</p>`,
);

exports.sendOrganizerAssignedEmail = (to, eventTitle, eventDate) => send(
  to,
  `You've been assigned as organizer: ${eventTitle}`,
  `<p>You have been assigned as the <b>organizer</b> for <b>${eventTitle}</b>` +
    (eventDate ? ` on <b>${new Date(eventDate).toLocaleDateString()}</b>` : '') + `.</p>`,
);

exports.sendNewOpportunityEmail = (to, eventTitle, roleName, eventDate) => send(
  to,
  `New volunteer opportunity: ${roleName} at ${eventTitle}`,
  `<p>A new volunteer role, <b>${roleName}</b>, has just opened up at <b>${eventTitle}</b>` +
    (eventDate ? ` on <b>${new Date(eventDate).toLocaleDateString()}</b>` : '') +
    `.</p><p>Visit UniVolve to view the details and apply.</p>`,
);

exports.sendWelcomeEmail = (to, fullName) => send(
  to,
  'Welcome to UniVolve',
  `<p>Hi <b>${fullName}</b>, your UniVolve account has been created. You can now browse events and apply for volunteer roles.</p>`,
);
