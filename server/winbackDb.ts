/**
 * Database helpers for the win-back email system.
 *
 * These functions are intentionally kept separate from the main db.ts so the
 * winback feature can be tested and reasoned about in isolation.
 */

import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  subscriptions,
  users,
  winbackEmailLogs,
  type InsertWinbackEmailLog,
  type Subscription,
  type WinbackEmailLog,
} from "../drizzle/schema";

export interface CancelledSubscriptionRow {
  subscriptionId: number;
  userId: number;
  plan: string;
  cancelledAt: Date;
  userEmail: string | null;
  userName: string | null;
}

/**
 * Return all cancelled subscriptions whose `cancelledAt` falls within the
 * supplied window [windowStart, windowEnd] and for which no win-back email of
 * the given type has already been sent.
 */
export async function getCancelledSubscriptionsForWindow(
  windowStart: Date,
  windowEnd: Date,
  emailType: "7day" | "30day"
): Promise<CancelledSubscriptionRow[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[WinbackDb] Database not available — returning empty result");
    return [];
  }

  // Fetch cancelled subscriptions in the time window
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      userId: subscriptions.userId,
      plan: subscriptions.plan,
      cancelledAt: subscriptions.cancelledAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(
      and(
        eq(subscriptions.status, "cancelled"),
        isNotNull(subscriptions.cancelledAt),
        gte(subscriptions.cancelledAt, windowStart),
        lte(subscriptions.cancelledAt, windowEnd)
      )
    );

  if (rows.length === 0) return [];

  // Filter out subscriptions that already have a log entry for this emailType
  const subscriptionIds = rows.map((r) => r.subscriptionId);

  const alreadySent = await db
    .select({ subscriptionId: winbackEmailLogs.subscriptionId })
    .from(winbackEmailLogs)
    .where(
      and(
        eq(winbackEmailLogs.emailType, emailType),
        sql`${winbackEmailLogs.subscriptionId} IN (${sql.join(
          subscriptionIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    );

  const alreadySentIds = new Set(alreadySent.map((r) => r.subscriptionId));

  return rows.filter(
    (r): r is CancelledSubscriptionRow =>
      !alreadySentIds.has(r.subscriptionId) && r.cancelledAt !== null
  ) as CancelledSubscriptionRow[];
}

/**
 * Persist a win-back email log entry (sent, failed, or skipped).
 */
export async function logWinbackEmail(
  entry: InsertWinbackEmailLog
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[WinbackDb] Database not available — skipping log write");
    return;
  }
  await db.insert(winbackEmailLogs).values(entry);
}

/**
 * Retrieve all win-back email logs (for admin audit purposes).
 */
export async function getWinbackEmailLogs(): Promise<WinbackEmailLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(winbackEmailLogs)
    .orderBy(sql`${winbackEmailLogs.sentAt} DESC`);
}

/**
 * Retrieve all subscriptions (for admin management).
 */
export async function getAllSubscriptions(): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .orderBy(sql`${subscriptions.createdAt} DESC`);
}

/**
 * Create a new subscription record.
 */
export async function createSubscription(data: {
  userId: number;
  plan: string;
  status?: "active" | "cancelled" | "expired" | "paused";
  cancelledAt?: Date;
  cancelReason?: string;
  amountPaid?: string;
  currency?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(subscriptions).values({
    userId: data.userId,
    plan: data.plan,
    status: data.status ?? "active",
    cancelledAt: data.cancelledAt ?? null,
    cancelReason: data.cancelReason ?? null,
    amountPaid: data.amountPaid ?? null,
    currency: data.currency ?? "GBP",
  });
}

/**
 * Mark a subscription as cancelled.
 */
export async function cancelSubscription(
  subscriptionId: number,
  cancelReason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: cancelReason ?? null,
    })
    .where(eq(subscriptions.id, subscriptionId));
}
