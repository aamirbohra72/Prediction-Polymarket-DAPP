import { prisma } from "@repo/database";
import { env } from "./env.js";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export function isEmailEnabled() {
  return (
    env.emailNotificationsEnabled &&
    Boolean(env.brevoApiKey) &&
    Boolean(env.brevoSenderEmail)
  );
}

function emailLayout({ title, body, ctaUrl, ctaLabel }) {
  const app = env.appName;
  const cta =
    ctaUrl &&
    `<p style="margin-top:24px"><a href="${ctaUrl}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${ctaLabel || "Open StockPredict"}</a></p>`;

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f4f6f9;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
  <p style="color:#64748b;font-size:12px;margin:0 0 8px">${app}</p>
  <h1 style="font-size:20px;margin:0 0 16px;color:#0f172a">${title}</h1>
  <p style="color:#334155;line-height:1.6;margin:0">${body}</p>
  ${cta || ""}
  <p style="margin-top:28px;font-size:11px;color:#94a3b8">Play money only. Not financial advice.</p>
</div></body></html>`;
}

/**
 * Send email via Brevo transactional API.
 * @see https://developers.brevo.com/docs/send-a-transactional-email
 */
export async function sendEmail({ to, subject, htmlContent, textContent }) {
  if (!isEmailEnabled()) return { sent: false, reason: "email_disabled" };

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: env.brevoSenderName,
        email: env.brevoSenderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent: textContent || subject,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[email] Brevo error:", res.status, errText);
    return { sent: false, reason: errText || res.statusText };
  }

  return { sent: true };
}

export async function sendEmailToUser(userId, { subject, title, body, marketId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  });
  if (!user?.email) return { sent: false };

  const marketUrl = marketId ? `${env.webOrigin}/markets/${marketId}` : env.webOrigin;
  const html = emailLayout({
    title: title || subject,
    body,
    ctaUrl: marketUrl,
    ctaLabel: marketId ? "View market" : "Go to app",
  });

  return sendEmail({
    to: user.email,
    subject: `[${env.appName}] ${subject}`,
    htmlContent: html,
    textContent: `${title || subject}\n\n${body}\n\n${marketUrl}`,
  });
}

export async function sendWelcomeEmail(user) {
  return sendEmailToUser(user.id, {
    subject: "Welcome — $10,000 play money to start",
    title: `Welcome${user.displayName ? `, ${user.displayName}` : ""}!`,
    body: `Your account is ready with <strong>$10,000</strong> in play money. Browse stock prediction markets, buy YES or NO shares, and compete on the leaderboard.`,
  });
}
