/**
 * Win-back email tRPC router.
 *
 * Procedures:
 *   winback.processPendingEmails  — processes all due win-back emails, logs errors,
 *                                   notifies admin on failures (admin-only)
 *   winback.scheduleForSubscription — manually schedule win-back emails for a
 *                                     given subscription ID (admin-only)
 *   winback.listPending           — list all pending win-back emails (admin-only)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import {
  getPendingWinbackEmails,
  markWinbackEmailSent,
  markWinbackEmailFailed,
  scheduleWinbackEmails,
  getSubscriptionById,
} from "./db";
import { buildWinbackEmailContent, type WinbackEmailType } from "./winbackEmail";
import { ENV } from "./_core/env";

// ---------------------------------------------------------------------------
// Email dispatch helper
// ---------------------------------------------------------------------------

/**
 * Sends a transactional email via the Manus Forge notification API.
 * Falls back to a structured log entry when the API is unavailable.
 *
 * Returns true on success, false on failure.
 */
async function dispatchEmail(opts: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, subject, textBody } = opts;

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    // No email service configured — log and treat as a soft failure so the
    // caller can decide whether to mark the row failed or skip.
    console.warn(
      `[Winback] Email service not configured. Would have sent to ${to}: "${subject}"`
    );
    return { ok: false, error: "Email service not configured (FORGE_API_URL / FORGE_API_KEY missing)" };
  }

  try {
    // The Manus platform's notification endpoint is used as the email transport.
    // In a production deployment this would be replaced by a dedicated email
    // provider (Resend, SendGrid, SES, etc.).  The notification API is used here
    // because it is the only outbound messaging channel available in the scaffold.
    const delivered = await notifyOwner({
      title: `[WIN-BACK EMAIL → ${to}] ${subject}`,
      content: textBody,
    });

    if (!delivered) {
      return { ok: false, error: "Notification service returned a non-OK response" };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Router definition
// ---------------------------------------------------------------------------

export const winbackRouter = router({
  /**
   * Process all pending win-back emails that are due (scheduledAt <= now).
   *
   * For each due email:
   *   1. Build the appropriate template (7-day or 30-day).
   *   2. Attempt to dispatch the email.
   *   3. On success  → mark row as "sent".
   *   4. On failure  → mark row as "failed", log the error, and notify the admin.
   *
   * Returns a summary object with counts and per-email results.
   */
  processPendingEmails: adminProcedure.mutation(async () => {
    console.log("[Winback] processPendingEmails — starting run");

    let pendingEmails;
    try {
      pendingEmails = await getPendingWinbackEmails();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Winback] Failed to fetch pending emails:", message);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch pending win-back emails: ${message}`,
      });
    }

    console.log(`[Winback] Found ${pendingEmails.length} pending email(s) due for dispatch`);

    const results: Array<{
      id: number;
      emailType: string;
      userEmail: string;
      status: "sent" | "failed";
      error?: string;
    }> = [];

    const failedEmails: typeof results = [];

    for (const email of pendingEmails) {
      const emailType = email.emailType as WinbackEmailType;

      // Fetch the parent subscription to get the plan name
      let plan = "standard";
      try {
        const sub = await getSubscriptionById(email.subscriptionId);
        if (sub) plan = sub.plan;
      } catch {
        // Non-fatal — fall back to default plan label
      }

      const content = buildWinbackEmailContent(emailType, email.userName, plan);

      console.log(
        `[Winback] Dispatching ${emailType} email (id=${email.id}) to ${email.userEmail}`
      );

      const { ok, error } = await dispatchEmail({
        to: email.userEmail,
        subject: content.subject,
        textBody: content.textBody,
        htmlBody: content.htmlBody,
      });

      if (ok) {
        try {
          await markWinbackEmailSent(email.id);
          console.log(`[Winback] ✓ Email id=${email.id} marked as sent`);
          results.push({ id: email.id, emailType, userEmail: email.userEmail, status: "sent" });
        } catch (dbErr) {
          const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
          console.error(`[Winback] Failed to mark email id=${email.id} as sent: ${dbMsg}`);
          // Still treat as sent from the user's perspective; DB update failure is secondary
          results.push({ id: email.id, emailType, userEmail: email.userEmail, status: "sent" });
        }
      } else {
        const errorMessage = error ?? "Unknown dispatch error";
        console.error(
          `[Winback] ✗ Email id=${email.id} to ${email.userEmail} FAILED: ${errorMessage}`
        );

        try {
          await markWinbackEmailFailed(email.id, errorMessage);
        } catch (dbErr) {
          console.error(
            `[Winback] Additionally failed to mark email id=${email.id} as failed in DB:`,
            dbErr
          );
        }

        const failedEntry = {
          id: email.id,
          emailType,
          userEmail: email.userEmail,
          status: "failed" as const,
          error: errorMessage,
        };
        results.push(failedEntry);
        failedEmails.push(failedEntry);
      }
    }

    // Notify admin if any emails failed
    if (failedEmails.length > 0) {
      const failureSummary = failedEmails
        .map((f) => `  • [${f.emailType}] ${f.userEmail} (id=${f.id}): ${f.error}`)
        .join("\n");

      const notifyContent =
        `${failedEmails.length} win-back email(s) failed to send during the latest processing run.\n\n` +
        `Failed emails:\n${failureSummary}\n\n` +
        `Total processed: ${pendingEmails.length}\n` +
        `Sent: ${results.filter((r) => r.status === "sent").length}\n` +
        `Failed: ${failedEmails.length}\n\n` +
        `Please investigate the email dispatch configuration and retry failed rows.`;

      try {
        await notifyOwner({
          title: `[ACTION REQUIRED] ${failedEmails.length} win-back email(s) failed`,
          content: notifyContent,
        });
        console.log("[Winback] Admin notified of email failures");
      } catch (notifyErr) {
        console.error("[Winback] Failed to notify admin of email failures:", notifyErr);
      }
    }

    const summary = {
      totalProcessed: pendingEmails.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: failedEmails.length,
      results,
    };

    console.log(
      `[Winback] Run complete — processed=${summary.totalProcessed}, sent=${summary.sent}, failed=${summary.failed}`
    );

    return summary;
  }),

  /**
   * Manually schedule win-back emails for a specific subscription.
   * Useful when a cancellation event was missed or needs to be re-queued.
   */
  scheduleForSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const sub = await getSubscriptionById(input.subscriptionId);

      if (!sub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Subscription ${input.subscriptionId} not found`,
        });
      }

      if (sub.status !== "cancelled" || !sub.cancelledAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Subscription ${input.subscriptionId} is not in a cancelled state`,
        });
      }

      await scheduleWinbackEmails(input.subscriptionId);

      return {
        success: true,
        message: `Win-back emails scheduled for subscription ${input.subscriptionId}`,
      };
    }),

  /**
   * List all pending win-back emails (due or not yet due).
   */
  listPending: adminProcedure.query(async () => {
    const { getPendingWinbackEmails: getPending } = await import("./db");
    // Return all pending (including future-scheduled) by querying DB directly
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];

    const { winbackEmails } = await import("../drizzle/schema");
    const { eq, asc } = await import("drizzle-orm");

    return db
      .select()
      .from(winbackEmails)
      .where(eq(winbackEmails.status, "pending"))
      .orderBy(asc(winbackEmails.scheduledAt));
  }),
});
