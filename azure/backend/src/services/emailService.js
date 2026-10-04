const { EmailClient } = require('@azure/communication-email');

const client = process.env.ACS_CONNECTION_STRING
  ? new EmailClient(process.env.ACS_CONNECTION_STRING)
  : null;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const template = (title, body, preheader = '') => `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f6fc;color:#17213a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e1e7f2;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#2f5fe3;padding:24px 30px;color:#ffffff;">
              <div style="font-size:22px;font-weight:700;letter-spacing:.2px;">🎓 UniVolve</div>
              <div style="font-size:12px;margin-top:7px;color:#dce6ff;">University volunteering and event management</div>
            </td>
          </tr>
          <tr><td style="padding:34px 30px 28px;">
            <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#17213a;">${title}</h1>
            <div style="font-size:15px;line-height:1.7;color:#4d5870;">${body}</div>
          </td></tr>
          <tr>
            <td style="border-top:1px solid #edf0f6;padding:18px 30px;color:#7a8499;font-size:12px;line-height:1.5;">
              You are receiving this message from UniVolve. Please do not reply to this automated email.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

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
  template(
    'Application update',
    `<p style="margin:0 0 16px;">Your application for <strong>${escapeHtml(roleName)}</strong> at <strong>${escapeHtml(eventTitle)}</strong> has been <strong>${escapeHtml(status)}</strong>.</p>`,
    `Your application for ${roleName} at ${eventTitle} has been ${status}.`,
  ),
);

exports.sendOrganizerAssignedEmail = (to, eventTitle, eventDate) => send(
  to,
  `You've been assigned as organizer: ${eventTitle}`,
  template(
    'You are the event organizer',
    `<p style="margin:0;">You have been assigned as the <strong>organizer</strong> for <strong>${escapeHtml(eventTitle)}</strong>${eventDate ? ` on <strong>${escapeHtml(new Date(eventDate).toLocaleDateString())}</strong>` : ''}.</p>`,
    `You have been assigned as the organizer for ${eventTitle}.`,
  ),
);

exports.sendNewOpportunityEmail = (to, eventTitle, roleName, eventDate) => send(
  to,
  `New volunteer opportunity: ${roleName} at ${eventTitle}`,
  template(
    'A new opportunity is waiting',
    `<p style="margin:0 0 16px;">A new volunteer role, <strong>${escapeHtml(roleName)}</strong>, has opened at <strong>${escapeHtml(eventTitle)}</strong>${eventDate ? ` on <strong>${escapeHtml(new Date(eventDate).toLocaleDateString())}</strong>` : ''}.</p><p style="margin:0;">Sign in to UniVolve to view the details and apply.</p>`,
    `A new volunteer role, ${roleName}, is available at ${eventTitle}.`,
  ),
);

exports.sendWelcomeEmail = (to, fullName) => send(
  to,
  'Welcome to UniVolve',
  template(
    'Welcome to UniVolve',
    `<p style="margin:0;">Hi <strong>${escapeHtml(fullName)}</strong>, your UniVolve account has been created. You can now browse events and apply for volunteer roles.</p>`,
    `Welcome to UniVolve, ${fullName}.`,
  ),
);
