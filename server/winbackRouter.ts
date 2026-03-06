/**
 * Win-back email tRPC router.
 *
 * Exposes:
 *  - winback.processPendingEmails  (admin) — sends scheduled 7-day and 30-day
 *    win-back emails to users who cancelled their subscriptions.
 *  - winback.getLogs               (admin) — audit log of all win-back emails.
 *  - winback.getSubscriptions      (admin) — list all subscriptions.
 *  - winback.cancelSubscription    (admin) — mark a subscription as cancelled.
 *
 * Email delivery uses Resend. On any per-email failure the error is logged to
 * the database AND a notification is sent to the admin via notifyOwner().
 * The procedure never throws for individual email failures; it collects all
 * results and returns a summary so the caller always gets a complete picture.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { adminProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";
import {
  getCancelledSubscriptionsForWindow,
  logWinbackEmail,
  getWinbackEmailLogs,
  getAllSubscriptions,
  cancelSubscription,
} from "./winbackDb";
import {
  buildWinbackEmailHtml,
  WINBACK_SUBJECTS,
  type WinbackEmailType,
} from "./winbackEmail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a Resend client, or throw a clear error if the key is missing. */
function getResendClient(): Resend {
  if (!ENV.resendApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "RESEND_API_KEY is not configured. Set it in the environment variables.",
    });
  }
  return new Resend(ENV.resendApiKey);
}

/**
 * Calculate the [windowStart, windowEnd] date range for a given email type.
 *
 * For 7-day emails  : subscriptions cancelled between 7 days ago ± 12 hours.
 * For 30-day emails : subscriptions cancelled between 30 days ago ± 12 hours.
 *
 * The ±12-hour tolerance ensures the cron job can run at any time of day
 * without missing users who cancelled at a slightly different hour.
 */
function getWindowForEmailType(
  type: WinbackEmailType,
  now: Date = new Date()
): { windowStart: Date; windowEnd: Date } {
  const TOLERANCE_MS = 12 * 60 * 60 * 1000; // 12 hours
  const DAY_MS = 24 * 60 * 60 * 1000;
  const targetDays = type === "7day" ? 7 : 30;
  const targetMs = targetDays * DAY_MS;

  const windowStart = new Date(now.getTime() - targetMs - TOLERANCE_MS);
  const windowEnd = new Date(now.getTime() - targetMs + TOLERANCE_MS);

  return { windowStart, windowEnd };
}

// ---------------------------------------------------------------------------
// Email-sending logic
// ---------------------------------------------------------------------------

interface EmailResult {
  subscriptionId: number;
  userId: number;
  recipientEmail: string;
  emailType: WinbackEmailType;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
}

/**
 * Attempt to send a single win-back email. Logs the outcome to the DB and
 * returns a result object. Never throws — all errors are captured.
 */
async function sendWinbackEmail(
  resend: Resend,
  opts: {
    subscriptionId: number;
    userId: number;
    recipientEmail: string;
    recipientName: string;
    plan: string;
    cancelledAt: Date;
    emailType: WinbackEmailType;
  }
): Promise<EmailResult> {
  const { subscriptionId, userId, recipientEmail, emailType } = opts;

  // Skip if recipient has no email address
  if (!recipientEmail) {
    const result: EmailResult = {
      subscriptionId,
      userId,
      recipientEmail: "",
      emailType,
      status: "skipped",
      errorMessage: "Recipient has no email address",
    };
    await logWinbackEmail({
      subscriptionId,
      userId,
      emailType,
      recipientEmail: "",
      status: "skipped",
      errorMessage: result.errorMessage,
    }).catch((err) =>
      console.error("[Winback] Failed to log skipped email:", err)
    );
    return result;
  }

  try {
    const html = buildWinbackEmailHtml(emailType, {
      recipientName: opts.recipientName || "Valued Customer",
      recipientEmail,
      plan: opts.plan,
      cancelledAt: opts.cancelledAt,
    });

    const { error } = await resend.emails.send({
      from: "Commercial Shot Blasting <noreply@commercialshotblasting.co.uk>",
      to: [recipientEmail],
      subject: WINBACK_SUBJECTS[emailType],
      html,
    });

    if (error) {
      throw new Error(error.message ?? "Resend returned an error");
    }

    await logWinbackEmail({
      subscriptionId,
      userId,
      emailType,
      recipientEmail,
      status: "sent",
    }).catch((err) =>
      console.error("[Winback] Failed to log sent email:", err)
    );

    console.info(
      `[Winback] ✓ Sent ${emailType} email to ${recipientEmail} (sub #${subscriptionId})`
    );

    return { subscriptionId, userId, recipientEmail, emailType, status: "sent" };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    console.error(
      `[Winback] ✗ Failed to send ${emailType} email to ${recipientEmail} (sub #${subscriptionId}): ${errorMessage}`
    );

    // Log failure to DB
    await logWinbackEmail({
      subscriptionId,
      userId,
      emailType,
      recipientEmail,
      status: "failed",
      errorMessage,
    }).catch((dbErr) =>
      console.error("[Winback] Failed to log email failure:", dbErr)
    );

    // Notify admin
    await notifyOwner({
      title: `Win-back email failed — ${emailType} (sub #${subscriptionId})`,
      content: [
        `**Email type:** ${emailType}`,
        `**Recipient:** ${recipientEmail}`,
        `**Subscription ID:** ${subscriptionId}`,
        `**User ID:** ${userId}`,
        `**Error:** ${errorMessage}`,
        `**Time:** ${new Date().toISOString()}`,
      ].join("\n"),
    }).catch((notifyErr) =>
      console.error("[Winback] Failed to notify admin:", notifyErr)
    );

    return {
      subscriptionId,
      userId,
      recipientEmail,
      emailType,
      status: "failed",
      errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const winbackRouter = router({
  /**
   * Process all pending win-back emails.
   *
   * Queries the database for cancelled subscriptions in the 7-day and 30-day
   * windows, sends the appropriate email to each user, logs every outcome, and
   * notifies the admin for any failures.
   *
   * Returns a detailed summary of every email attempted.
   */
  processPendingEmails: adminProcedure
    .input(
      z.object({
        /** Override the reference "now" timestamp (useful for testing). */
        referenceTime: z.string().datetime().optional(),
        /** Limit which email types to process (default: both). */
        emailTypes: z
          .array(z.enum(["7day", "30day"]))
          .optional(),
        /** Dry-run: query and log but do not actually send emails. */
        dryRun: z.boolean().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const now = input?.referenceTime
        ? new Date(input.referenceTime)
        : new Date();
      const emailTypes: WinbackEmailType[] = (input?.emailTypes ??
        ["7day", "30day"]) as WinbackEmailType[];
      const dryRun = input?.dryRun ?? false;

      const resend = dryRun ? null : getResendClient();

      const results: EmailResult[] = [];
      const errors: string[] = [];

      console.info(
        `[Winback] Starting processPendingEmails — types: ${emailTypes.join(", ")}, dryRun: ${dryRun}, referenceTime: ${now.toISOString()}`
      );

      for (const emailType of emailTypes) {
        const { windowStart, windowEnd } = getWindowForEmailType(
          emailType,
          now
        );

        console.info(
          `[Winback] Querying ${emailType} window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`
        );

        let candidates;
        try {
          candidates = await getCancelledSubscriptionsForWindow(
            windowStart,
            windowEnd,
            emailType
          );
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Unknown DB error";
          const errMsg = `Failed to query ${emailType} candidates: ${msg}`;
          console.error(`[Winback] ${errMsg}`);
          errors.push(errMsg);

          // Notify admin of the query failure
          await notifyOwner({
            title: `Win-back DB query failed — ${emailType}`,
            content: [
              `**Email type:** ${emailType}`,
              `**Error:** ${msg}`,
              `**Time:** ${now.toISOString()}`,
            ].join("\n"),
          }).catch((e) =>
            console.error("[Winback] Failed to notify admin of DB error:", e)
          );

          continue;
        }

        console.info(
          `[Winback] Found ${candidates.length} pending ${emailType} recipient(s)`
        );

        for (const candidate of candidates) {
          if (!candidate.userEmail) {
            // No email address — log as skipped
            const skipped: EmailResult = {
              subscriptionId: candidate.subscriptionId,
              userId: candidate.userId,
              recipientEmail: "",
              emailType,
              status: "skipped",
              errorMessage: "User has no email address on record",
            };
            results.push(skipped);
            await logWinbackEmail({
              subscriptionId: candidate.subscriptionId,
              userId: candidate.userId,
              emailType,
              recipientEmail: "",
              status: "skipped",
              errorMessage: skipped.errorMessage,
            }).catch((e) =>
              console.error("[Winback] Failed to log skipped email:", e)
            );
            continue;
          }

          if (dryRun) {
            console.info(
              `[Winback] [DRY RUN] Would send ${emailType} to ${candidate.userEmail} (sub #${candidate.subscriptionId})`
            );
            results.push({
              subscriptionId: candidate.subscriptionId,
              userId: candidate.userId,
              recipientEmail: candidate.userEmail,
              emailType,
              status: "skipped",
              errorMessage: "Dry run — email not sent",
            });
            continue;
          }

          const result = await sendWinbackEmail(resend!, {
            subscriptionId: candidate.subscriptionId,
            userId: candidate.userId,
            recipientEmail: candidate.userEmail,
            recipientName: candidate.userName ?? "",
            plan: candidate.plan,
            cancelledAt: candidate.cancelledAt,
            emailType,
          });
          results.push(result);
        }
      }

      // Build summary
      const sent = results.filter((r) => r.status === "sent").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const total = results.length;

      console.info(
        `[Winback] Completed — total: ${total}, sent: ${sent}, failed: ${failed}, skipped: ${skipped}`
      );

      // If there were any failures, send a consolidated admin notification
      if (failed > 0 && !dryRun) {
        const failedList = results
          .filter((r) => r.status === "failed")
          .map(
            (r) =>
              `• sub #${r.subscriptionId} (${r.emailType}) → ${r.recipientEmail}: ${r.errorMessage}`
          )
          .join("\n");

        await notifyOwner({
          title: `Win-back batch completed with ${failed} failure(s)`,
          content: [
            `**Summary:** ${sent} sent, ${failed} failed, ${skipped} skipped out of ${total} total`,
            ``,
            `**Failed emails:**`,
            failedList,
            ``,
            `**Run time:** ${now.toISOString()}`,
          ].join("\n"),
        }).catch((e) =>
          console.error("[Winback] Failed to send batch summary notification:", e)
        );
      }

      return {
        success: true,
        dryRun,
        summary: { total, sent, failed, skipped },
        results: results.map((r) => ({
          subscriptionId: r.subscriptionId,
          userId: r.userId,
          recipientEmail: r.recipientEmail,
          emailType: r.emailType,
          status: r.status,
          ...(r.errorMessage ? { errorMessage: r.errorMessage } : {}),
        })),
        errors,
      };
    }),

  /**
   * Retrieve the full win-back email audit log.
   */
  getLogs: adminProcedure.query(async () => {
    return getWinbackEmailLogs();
  }),

  /**
   * List all subscriptions (for admin management).
   */
  getSubscriptions: adminProcedure.query(async () => {
    return getAllSubscriptions();
  }),

  /**
   * Mark a subscription as cancelled (triggers win-back sequence on next run).
   */
  cancelSubscription: adminProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        cancelReason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await cancelSubscription(input.subscriptionId, input.cancelReason);
      return { success: true };
    }),
});
