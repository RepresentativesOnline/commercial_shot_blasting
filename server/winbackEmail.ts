/**
 * Win-back email templates for 7-day and 30-day post-cancellation sequences.
 *
 * Emails are sent from info@optimised.marketing via the Manus Forge Data API
 * (Resend integration). Each template is self-contained HTML so it renders
 * correctly in all major email clients.
 */

export type WinbackEmailType = "7day" | "30day";

export interface WinbackEmailContext {
  recipientName: string;
  recipientEmail: string;
  plan: string;
  cancelledAt: Date;
}

/** Subject lines keyed by email type */
export const WINBACK_SUBJECTS: Record<WinbackEmailType, string> = {
  "7day":
    "We miss you — here's an exclusive offer to come back to Commercial Shot Blasting",
  "30day":
    "Last chance: a special deal just for you from Commercial Shot Blasting",
};

/** Build the HTML body for a win-back email */
export function buildWinbackEmailHtml(
  type: WinbackEmailType,
  ctx: WinbackEmailContext
): string {
  const firstName = ctx.recipientName.split(" ")[0] ?? ctx.recipientName;
  const planLabel = ctx.plan
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (type === "7day") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We miss you</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .header p { color: #a0a0c0; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #333333; line-height: 1.6; }
    .body h2 { color: #1a1a2e; font-size: 20px; margin-top: 0; }
    .highlight { background: #f0f4ff; border-left: 4px solid #4f46e5; padding: 16px 20px; border-radius: 4px; margin: 24px 0; }
    .cta { display: block; width: fit-content; margin: 32px auto; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .footer { background: #f4f4f4; padding: 24px 40px; text-align: center; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Commercial Shot Blasting</h1>
      <p>Professional Surface Preparation Across the UK</p>
    </div>
    <div class="body">
      <h2>Hi ${firstName},</h2>
      <p>
        It's been a week since you cancelled your <strong>${planLabel}</strong> subscription,
        and we wanted to reach out personally to see if there's anything we can do to bring
        you back.
      </p>
      <p>
        Whether it was pricing, timing, or something else entirely — we'd love to hear from
        you. As a token of appreciation for being a valued customer, we're offering you
        an exclusive <strong>10% discount</strong> if you reactivate within the next 7 days.
      </p>
      <div class="highlight">
        <strong>Your exclusive offer:</strong> Use code <code>COMEBACK10</code> at checkout
        for 10% off your first month back. Valid for 7 days only.
      </div>
      <a class="cta" href="https://commercialshotblasting.co.uk/pricing?ref=winback7">
        Reactivate My Subscription
      </a>
      <p>
        If you have any questions or feedback, simply reply to this email — we read every
        message and would love to hear from you.
      </p>
      <p>Warm regards,<br /><strong>The Commercial Shot Blasting Team</strong></p>
    </div>
    <div class="footer">
      <p>Commercial Shot Blasting &bull; Nationwide UK Coverage</p>
      <p>
        You're receiving this because you recently cancelled your subscription.
        If you believe this was sent in error, please
        <a href="mailto:info@commercialshotblasting.co.uk">contact us</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // 30-day template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Last chance offer</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: #0f172a; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .header p { color: #94a3b8; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #333333; line-height: 1.6; }
    .body h2 { color: #0f172a; font-size: 20px; margin-top: 0; }
    .highlight { background: #fff7ed; border-left: 4px solid #f97316; padding: 16px 20px; border-radius: 4px; margin: 24px 0; }
    .cta { display: block; width: fit-content; margin: 32px auto; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .footer { background: #f4f4f4; padding: 24px 40px; text-align: center; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Commercial Shot Blasting</h1>
      <p>Professional Surface Preparation Across the UK</p>
    </div>
    <div class="body">
      <h2>Hi ${firstName},</h2>
      <p>
        It's been 30 days since you cancelled your <strong>${planLabel}</strong> subscription.
        We haven't forgotten about you, and we wanted to make one final offer before we
        close the door on your exclusive win-back deal.
      </p>
      <p>
        We've improved our service based on customer feedback and we think you'll notice
        the difference. To make it as easy as possible to come back, we're offering you
        an even bigger <strong>20% discount</strong> on your first two months.
      </p>
      <div class="highlight">
        <strong>Your last-chance offer:</strong> Use code <code>RETURN20</code> at checkout
        for 20% off your first two months back. This offer expires in 48 hours.
      </div>
      <a class="cta" href="https://commercialshotblasting.co.uk/pricing?ref=winback30">
        Claim My 20% Discount
      </a>
      <p>
        If now still isn't the right time, we completely understand. We hope to see you
        again in the future. If you'd like to share any feedback about why you left, we'd
        genuinely appreciate hearing from you — just reply to this email.
      </p>
      <p>Best wishes,<br /><strong>The Commercial Shot Blasting Team</strong></p>
    </div>
    <div class="footer">
      <p>Commercial Shot Blasting &bull; Nationwide UK Coverage</p>
      <p>
        You're receiving this because you cancelled your subscription 30 days ago.
        If you believe this was sent in error, please
        <a href="mailto:info@commercialshotblasting.co.uk">contact us</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}
