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

exports.sendOrganizerAssignedEmail = async (to, eventTitle, eventDate) => {
  try {
    await transport.sendMail({
      from: 'noreply@vms.local',
      to,
      subject: `You've been assigned as organizer: ${eventTitle}`,
      html: `<p>You have been assigned as the <b>organizer</b> for <b>${eventTitle}</b>` +
        (eventDate ? ` on <b>${new Date(eventDate).toLocaleDateString()}</b>` : '') + `.</p>`,
    });
  } catch (e) {
    console.error('Email send failed (non-fatal):', e.message);
  }
};

exports.sendNewOpportunityEmail = async (to, eventTitle, roleName, eventDate) => {
  try {
    await transport.sendMail({
      from: 'noreply@vms.local',
      to,
      subject: `New volunteer opportunity: ${roleName} at ${eventTitle}`,
      html: `<p>A new volunteer role, <b>${roleName}</b>, has just opened up at <b>${eventTitle}</b>` +
        (eventDate ? ` on <b>${new Date(eventDate).toLocaleDateString()}</b>` : '') +
        `.</p><p>Visit UniVolve to view the details and apply.</p>`,
    });
  } catch (e) {
    console.error('Email send failed (non-fatal):', e.message);
  }
};

exports.sendInvitationEmail = async (to, eventTitle, roleName) => {
  try {
    await transport.sendMail({
      from: 'noreply@vms.local',
      to,
      subject: `You've been invited: ${roleName} at ${eventTitle}`,
      html: `<p>The organizer of <b>${eventTitle}</b> has invited you to volunteer as <b>${roleName}</b>.</p>` +
        `<p>Visit UniVolve → Volunteer Requests to accept or decline.</p>`,
    });
  } catch (e) {
    console.error('Email send failed (non-fatal):', e.message);
  }
};

exports.sendWelcomeEmail = async (to, fullName) => {
  try {
    await transport.sendMail({
      from: 'noreply@vms.local',
      to,
      subject: 'Welcome to UniVolve',
      html: `<p>Hi <b>${fullName}</b>, your UniVolve account has been created. You can now browse events and apply for volunteer roles.</p>`,
    });
  } catch (e) {
    console.error('Email send failed (non-fatal):', e.message);
  }
};
