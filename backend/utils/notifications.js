function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildDeadlineReminderMessage(taskTitle) {
  return `🎯 Final 24 hours! Complete your ${taskTitle} and stay on track with your goals.`;
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      sent: false,
      skipped: true,
      reason: 'Email is not configured. Set RESEND_API_KEY and EMAIL_FROM in .env.'
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html
    })
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseBody.message || 'Resend email request failed');
  }

  return {
    sent: true,
    provider: 'resend',
    providerId: responseBody.id
  };
}

async function sendDeadlineReminderEmail({ to, taskTitle }) {
  const safeTaskTitle = escapeHtml(taskTitle);
  const message = buildDeadlineReminderMessage(taskTitle);
  const subject = `Final 24 hours: ${taskTitle}`;

  return sendWithResend({
    to,
    subject,
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2521;">
        <p>🎯 Final 24 hours! Complete your <strong>${safeTaskTitle}</strong> and stay on track with your goals.</p>
      </div>
    `
  });
}

module.exports = {
  buildDeadlineReminderMessage,
  sendDeadlineReminderEmail
};
