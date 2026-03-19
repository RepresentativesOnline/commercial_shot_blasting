/**
 * Tests for the winback tRPC router and email content builder.
 *
 * All database and notification calls are mocked so the tests run
 * without a live database or email service.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { buildWinbackEmailContent } from "./winbackEmail";

// ---------------------------------------------------------------------------
// Mocks — factories must not reference top-level variables (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("./db", () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 1000);

  const mockPendingEmails = [
    {
      id: 1,
      subscriptionId: 10,
      userId: 100,
      userEmail: "alice@example.com",
      userName: "Alice",
      emailType: "7day",
      scheduledAt: pastDate,
      sentAt: null,
      status: "pending",
      errorMessage: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      subscriptionId: 11,
      userId: 101,
      userEmail: "bob@example.com",
      userName: "Bob",
      emailType: "30day",
      scheduledAt: pastDate,
      sentAt: null,
      status: "pending",
      errorMessage: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const mockSubscription = {
    id: 10,
    userId: 100,
    userEmail: "alice@example.com",
    userName: "Alice",
    plan: "pro",
    status: "cancelled",
    cancelledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    getPendingWinbackEmails: vi.fn().mockResolvedValue(mockPendingEmails),
    markWinbackEmailSent: vi.fn().mockResolvedValue(undefined),
    markWinbackEmailFailed: vi.fn().mockResolvedValue(undefined),
    scheduleWinbackEmails: vi.fn().mockResolvedValue(undefined),
    getSubscriptionById: vi.fn().mockResolvedValue(mockSubscription),
    getDb: vi.fn().mockResolvedValue(null),
    // Existing helpers required by other routers
    createContactSubmission: vi.fn().mockResolvedValue(undefined),
    getContactSubmissions: vi.fn().mockResolvedValue([]),
    updateContactSubmissionStatus: vi.fn().mockResolvedValue(undefined),
    deleteContactSubmission: vi.fn().mockResolvedValue(undefined),
    getActiveGalleryItems: vi.fn().mockResolvedValue([]),
    getAllGalleryItems: vi.fn().mockResolvedValue([]),
    createGalleryItem: vi.fn().mockResolvedValue(undefined),
    updateGalleryItem: vi.fn().mockResolvedValue(undefined),
    deleteGalleryItem: vi.fn().mockResolvedValue(undefined),
    getActiveTestimonials: vi.fn().mockResolvedValue([]),
    getAllTestimonials: vi.fn().mockResolvedValue([]),
    createTestimonial: vi.fn().mockResolvedValue(undefined),
    updateTestimonial: vi.fn().mockResolvedValue(undefined),
    deleteTestimonial: vi.fn().mockResolvedValue(undefined),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(undefined),
    getPublishedBlogPosts: vi.fn().mockResolvedValue([]),
    getAllBlogPosts: vi.fn().mockResolvedValue([]),
    getBlogPostBySlug: vi.fn().mockResolvedValue(undefined),
    createBlogPost: vi.fn().mockResolvedValue(undefined),
    updateBlogPost: vi.fn().mockResolvedValue(undefined),
    deleteBlogPost: vi.fn().mockResolvedValue(undefined),
    getPageContentSections: vi.fn().mockResolvedValue([]),
    getAllPageContentSections: vi.fn().mockResolvedValue([]),
    getPageContentSection: vi.fn().mockResolvedValue(undefined),
    createPageContentSection: vi.fn().mockResolvedValue(undefined),
    updatePageContentSection: vi.fn().mockResolvedValue(undefined),
    deletePageContentSection: vi.fn().mockResolvedValue(undefined),
    upsertPageContentSection: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function makeUser(role: "admin" | "user") {
  const now = new Date();
  return {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-open-id`,
    name: role === "admin" ? "Admin" : "User",
    email: `${role}@example.com`,
    role,
    loginMethod: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: makeUser("admin"),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: makeUser("user"),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ---------------------------------------------------------------------------
// Email content builder tests
// ---------------------------------------------------------------------------

describe("buildWinbackEmailContent", () => {
  it("builds a 7-day email with personalised greeting", () => {
    const content = buildWinbackEmailContent("7day", "Alice", "pro");
    expect(content.subject).toContain("miss you");
    expect(content.textBody).toContain("Hi Alice");
    expect(content.htmlBody).toContain("Hi Alice");
    expect(content.textBody).toContain("pro");
  });

  it("builds a 30-day email with special offer", () => {
    const content = buildWinbackEmailContent("30day", "Bob", "standard");
    expect(content.subject).toContain("special offer");
    expect(content.textBody).toContain("Hi Bob");
    expect(content.textBody).toContain("complimentary site survey");
    expect(content.htmlBody).toContain("complimentary site survey");
  });

  it("uses a generic greeting when name is null", () => {
    const content = buildWinbackEmailContent("7day", null, "standard");
    expect(content.textBody).toContain("Hello,");
  });

  it("uses a generic greeting when name is undefined", () => {
    const content = buildWinbackEmailContent("30day", undefined, "pro");
    expect(content.textBody).toContain("Hello,");
  });

  it("includes contact details in both email types", () => {
    for (const type of ["7day", "30day"] as const) {
      const content = buildWinbackEmailContent(type, "Test", "standard");
      expect(content.textBody).toContain("07970 566409");
      expect(content.textBody).toContain("info@commercialshotblasting.co.uk");
    }
  });
});

// ---------------------------------------------------------------------------
// winback.processPendingEmails tests
// ---------------------------------------------------------------------------

describe("winback.processPendingEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.winback.processPendingEmails()).rejects.toThrow();
  });

  it("rejects non-admin authenticated callers", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.winback.processPendingEmails()).rejects.toThrow();
  });

  it("processes pending emails and returns a summary for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.winback.processPendingEmails();

    expect(result.totalProcessed).toBe(2);
    expect(result.results).toHaveLength(2);
    // Both emails should be attempted (sent or failed depending on env config)
    for (const r of result.results) {
      expect(["sent", "failed"]).toContain(r.status);
    }
  });

  it("returns zero counts when no emails are pending", async () => {
    const db = await import("./db");
    (db.getPendingWinbackEmails as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.winback.processPendingEmails();

    expect(result.totalProcessed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("marks emails as failed and notifies admin when dispatch fails", async () => {
    const db = await import("./db");
    const notif = await import("./_core/notification");

    // Only one email pending
    (db.getPendingWinbackEmails as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        subscriptionId: 10,
        userId: 100,
        userEmail: "alice@example.com",
        userName: "Alice",
        emailType: "7day",
        scheduledAt: new Date(Date.now() - 1000),
        sentAt: null,
        status: "pending",
        errorMessage: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // When ENV.forgeApiUrl / forgeApiKey are not set (test environment), dispatchEmail
    // returns early WITHOUT calling notifyOwner — the failure is detected via the
    // missing-config path.  The admin notification IS still sent via notifyOwner.
    // So notifyOwner is called exactly once (for the admin alert).
    (notif.notifyOwner as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.winback.processPendingEmails();

    expect(result.failed).toBe(1);
    expect(db.markWinbackEmailFailed).toHaveBeenCalledWith(1, expect.any(String));
    // Admin should have been notified once (the admin alert call)
    expect(notif.notifyOwner).toHaveBeenCalledTimes(1);
    expect(notif.notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("ACTION REQUIRED") })
    );
  });
});

// ---------------------------------------------------------------------------
// winback.scheduleForSubscription tests
// ---------------------------------------------------------------------------

describe("winback.scheduleForSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schedules win-back emails for a cancelled subscription", async () => {
    const db = await import("./db");
    const now = new Date();
    (db.getSubscriptionById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 10,
      userId: 100,
      userEmail: "alice@example.com",
      userName: "Alice",
      plan: "pro",
      status: "cancelled",
      cancelledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    });

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.winback.scheduleForSubscription({ subscriptionId: 10 });

    expect(result.success).toBe(true);
    expect(db.scheduleWinbackEmails).toHaveBeenCalledWith(10);
  });

  it("throws NOT_FOUND when subscription does not exist", async () => {
    const db = await import("./db");
    (db.getSubscriptionById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.winback.scheduleForSubscription({ subscriptionId: 9999 })
    ).rejects.toThrow("not found");
  });

  it("throws BAD_REQUEST when subscription is not cancelled", async () => {
    const db = await import("./db");
    const now = new Date();
    (db.getSubscriptionById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 10,
      userId: 100,
      userEmail: "alice@example.com",
      userName: "Alice",
      plan: "pro",
      status: "active",
      cancelledAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    });

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.winback.scheduleForSubscription({ subscriptionId: 10 })
    ).rejects.toThrow("not in a cancelled state");
  });
});
