/**
 * Win-back email content templates for cancelled subscribers.
 *
 * Two email types are supported:
 *   - "7day"  : sent 7 days after cancellation — empathetic re-engagement
 *   - "30day" : sent 30 days after cancellation — stronger incentive / offer
 */

export type WinbackEmailType = "7day" | "30day";

export interface WinbackEmailContent {
  subject: string;
  textBody: string;
  htmlBody: string;
}

const COMPANY_NAME = "Commercial Shot Blasting";
const CONTACT_EMAIL = "info@commercialshotblasting.co.uk";
const CONTACT_PHONE = "07970 566409";
const WEBSITE_URL = "https://www.commercialshotblasting.co.uk";

/**
 * Build the email content for a given win-back type.
 */
export function buildWinbackEmailContent(
  emailType: WinbackEmailType,
  recipientName: string | null | undefined,
  plan: string
): WinbackEmailContent {
  const greeting = recipientName ? `Hi ${recipientName}` : "Hello";

  if (emailType === "7day") {
    const subject = `We miss you — come back to ${COMPANY_NAME}`;
    const textBody = `${greeting},

It's been a week since you cancelled your ${plan} subscription with ${COMPANY_NAME}, and we wanted to reach out personally.

We understand that circumstances change, and we respect your decision. However, if there was anything about our service that didn't meet your expectations, we'd genuinely love to hear from you — your feedback helps us improve.

If you're ready to come back, we're here for you. Our team is available to discuss your shot blasting requirements and find a solution that works for you.

Get back in touch:
  Phone : ${CONTACT_PHONE}
  Email : ${CONTACT_EMAIL}
  Web   : ${WEBSITE_URL}

We hope to hear from you soon.

Warm regards,
The ${COMPANY_NAME} Team
`;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1a1a2e;">${greeting},</h2>
  <p>It's been a week since you cancelled your <strong>${plan}</strong> subscription with <strong>${COMPANY_NAME}</strong>, and we wanted to reach out personally.</p>
  <p>We understand that circumstances change, and we respect your decision. However, if there was anything about our service that didn't meet your expectations, we'd genuinely love to hear from you — your feedback helps us improve.</p>
  <p>If you're ready to come back, our expert team is available to discuss your shot blasting requirements and find a solution that works for you.</p>
  <table style="margin:20px 0;border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Phone</td><td><a href="tel:${CONTACT_PHONE}">${CONTACT_PHONE}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Website</td><td><a href="${WEBSITE_URL}">${WEBSITE_URL}</a></td></tr>
  </table>
  <p>We hope to hear from you soon.</p>
  <p>Warm regards,<br><strong>The ${COMPANY_NAME} Team</strong></p>
</body>
</html>`;

    return { subject, textBody, htmlBody };
  }

  // 30-day email — stronger incentive
  const subject = `A special offer just for you — ${COMPANY_NAME}`;
  const textBody = `${greeting},

It's been 30 days since you left us, and we haven't forgotten about you.

As a valued former customer, we'd like to offer you a complimentary site survey and a priority quote for your next shot blasting project — no obligation, no pressure.

Our services cover:
  • Structural steel frames & fabrications
  • Industrial floors & warehouse racking
  • Bridges, cranes & heavy infrastructure
  • Nationwide UK coverage

To redeem your free site survey, simply reply to this email or call us directly:
  Phone : ${CONTACT_PHONE}
  Email : ${CONTACT_EMAIL}
  Web   : ${WEBSITE_URL}

This offer is available for a limited time. We'd love the opportunity to show you what we can do.

Best wishes,
The ${COMPANY_NAME} Team
`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1a1a2e;">${greeting},</h2>
  <p>It's been 30 days since you left us, and we haven't forgotten about you.</p>
  <p>As a valued former customer, we'd like to offer you a <strong>complimentary site survey and a priority quote</strong> for your next shot blasting project — no obligation, no pressure.</p>
  <h3 style="color:#1a1a2e;">Our services cover:</h3>
  <ul>
    <li>Structural steel frames &amp; fabrications</li>
    <li>Industrial floors &amp; warehouse racking</li>
    <li>Bridges, cranes &amp; heavy infrastructure</li>
    <li>Nationwide UK coverage</li>
  </ul>
  <p>To redeem your free site survey, simply reply to this email or contact us directly:</p>
  <table style="margin:20px 0;border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Phone</td><td><a href="tel:${CONTACT_PHONE}">${CONTACT_PHONE}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Website</td><td><a href="${WEBSITE_URL}">${WEBSITE_URL}</a></td></tr>
  </table>
  <p><em>This offer is available for a limited time. We'd love the opportunity to show you what we can do.</em></p>
  <p>Best wishes,<br><strong>The ${COMPANY_NAME} Team</strong></p>
</body>
</html>`;

  return { subject, textBody, htmlBody };
}
