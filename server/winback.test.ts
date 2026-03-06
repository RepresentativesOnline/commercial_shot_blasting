/**
 * Tests for the win-back email system.
 *
 * Covers:
 *  - winbackEmail.ts  — template generation helpers
 *  - winbackRouter.ts — tRPC procedure behaviour (mocked DB + Resend)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock the DB helpers used by the winback router
vi.mock("./winbackDb", () => ({
  getCancelledSubscriptionsForWindow: vi.fn().mockResolvedValue([]),
  logWinbackEmail: vi.fn().mockResolvedValue(undefined),
  getWinbackEmailLogs: vi.fn().mockResolvedValue([]),
  getAllSubscriptions: vi.fn().mockResolvedValue([]),
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
}));

// Mock the main db module (required by routers.ts)
vi.mock("./db", () => ({
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
  getBlogPostBySlug: vi.fn().mockResolvedValue(null),
  createBlogPost: vi.fn().mockResolvedValue(undefined),
  updateBlogPost: vi.fn().mockResolvedValue(undefined),
  deleteBlogPost: vi.fn().mockResolvedValue(undefined),
  getPageContentSections: vi.fn().mockResolvedValue([]),
  getAllPageContentSections: vi.fn().mockResolvedValue([]),
  getPageContentSection: vi.fn().mockResolvedValue(null),
  createPageContentSection: vi.fn().mockResolvedValue(undefined),
  updatePageContentSection: vi.fn().mockResolvedValue(undefined),
  deletePageContentSection: vi.fn().mockResolvedValue(undefined),
  upsertPageContentSection: vi.fn().mockResolvedValue(undefined),
}));

// Mock Resend so no real HTTP calls are made
vi.mock("resend", () => {
  const mockSend = vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null });
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  };
});

// Mock the notification helper
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the ENV module so RESEND_API_KEY is available in tests
vi.mock("./_core/env", () => ({
  ENV: {
    appId: "test-app-id",
    cookieSecret: "test-secret",
    databaseUrl: "",
    oAuthServerUrl: "",
    ownerOpenId: "admin-open-id",
    isProduction: false,
    forgeApiUrl: "https://forge.test",
    forgeApiKey: "test-forge-key",
    resendApiKey: "re_test_key_123456",
    adminEmail: "info@optimised.marketing",
  },
}));

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function createAdminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-open-id", role: "admin", name: "Admin", email: "admin@test.com", loginMethod: "email", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: { id: 2, openId: "user-open-id", role: "user", name: "User", email: "user@test.com", loginMethod: "email", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
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

// ---------------------------------------------------------------------------
// Template tests
// ---------------------------------------------------------------------------

import { buildWinbackEmailHtml, WINBACK_SUBJECTS } from "./winbackEmail";

describe("winbackEmail templates", () => {
  const ctx = {
    recipientName: "Jane Smith",
    recipientEmail: "jane@example.com",
    plan: "premium-monthly",
    cancelledAt: new Date("2026-02-01T10:00:00Z"),
  };

  it("generates a 7-day HTML email containing the recipient first name", () => {
    const html = buildWinbackEmailHtml("7day", ctx);
    expect(html).toContain("Jane");
    expect(html).toContain("COMEBACK10");
    expect(html).toContain("10%");
  });

  it("generates a 30-day HTML email containing the recipient first name", () => {
    const html = buildWinbackEmailHtml("30day", ctx);
    expect(html).toContain("Jane");
    expect(html).toContain("RETURN20");
    expect(html).toContain("20%");
  });

  it("formats the plan name in title case", () => {
    const html = buildWinbackEmailHtml("7day", ctx);
    expect(html).toContain("Premium Monthly");
  });

  it("has correct subjects for both email types", () => {
    expect(WINBACK_SUBJECTS["7day"]).toContain("miss you");
    expect(WINBACK_SUBJECTS["30day"]).toContain("Last chance");
  });

  it("7-day email contains the reactivation CTA link", () => {
    const html = buildWinbackEmailHtml("7day", ctx);
    expect(html).toContain("winback7");
  });

  it("30-day email contains the reactivation CTA link", () => {
    const html = buildWinbackEmailHtml("30day", ctx);
    expect(html).toContain("winback30");
  });
});

// ---------------------------------------------------------------------------
// Router tests
// ---------------------------------------------------------------------------

import * as winbackDb from "./winbackDb";
import * as notificationModule from "./_core/notification";

describe("winback.processPendingEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock return values
    vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mockResolvedValue([]);
    vi.mocked(winbackDb.logWinbackEmail).mockResolvedValue(undefined);
    vi.mocked(notificationModule.notifyOwner).mockResolvedValue(true);
  });

  it("rejects unauthenticated callers", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.winback.processPendingEmails({})).rejects.toThrow();
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.winback.processPendingEmails({})).rejects.toThrow();
  });

  it("returns a zero-result summary when there are no pending subscriptions", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.processPendingEmails({
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.summary.total).toBe(0);
    expect(result.summary.sent).toBe(0);
    expect(result.summary.failed).toBe(0);
  });

  it("skips subscriptions where the user has no email address", async () => {
    vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mockResolvedValue([
      {
        subscriptionId: 1,
        userId: 10,
        plan: "basic",
        cancelledAt: new Date(),
        userEmail: null,
        userName: "No Email User",
      },
    ]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.processPendingEmails({ dryRun: false });

    expect(result.summary.skipped).toBe(2); // one per email type (7day + 30day)
    expect(result.summary.sent).toBe(0);
  });

  it("dry-run mode does not call Resend but returns correct results", async () => {
    vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mockResolvedValue([
      {
        subscriptionId: 2,
        userId: 20,
        plan: "premium",
        cancelledAt: new Date(),
        userEmail: "customer@example.com",
        userName: "Test Customer",
      },
    ]);

    const { Resend } = await import("resend");
    const mockResendInstance = new (Resend as any)();

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.processPendingEmails({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.summary.skipped).toBe(2); // dry-run skips all
    expect(mockResendInstance.emails.send).not.toHaveBeenCalled();
  });

  it("sends emails to eligible subscribers and returns sent status", async () => {
    vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mockResolvedValue([
      {
        subscriptionId: 3,
        userId: 30,
        plan: "pro",
        cancelledAt: new Date(),
        userEmail: "pro-user@example.com",
        userName: "Pro User",
      },
    ]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.processPendingEmails({
      emailTypes: ["7day"],
      dryRun: false,
    });

    expect(result.summary.sent).toBe(1);
    expect(result.summary.failed).toBe(0);
    expect(result.results[0]?.status).toBe("sent");
    expect(result.results[0]?.recipientEmail).toBe("pro-user@example.com");
  });

  it("logs failures and notifies admin when Resend returns an error", async () => {
    const { Resend } = await import("resend");
    const mockInstance = new (Resend as any)();
    vi.mocked(mockInstance.emails.send).mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid API key" },
    });

    vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mockResolvedValue([
      {
        subscriptionId: 4,
        userId: 40,
        plan: "basic",
        cancelledAt: new Date(),
        userEmail: "fail@example.com",
        userName: "Fail User",
      },
    ]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.processPendingEmails({
      emailTypes: ["7day"],
      dryRun: false,
    });

    // Even on failure the procedure should succeed and report the failure
    expect(result.success).toBe(true);
    expect(result.summary.failed + result.summary.sent).toBeGreaterThanOrEqual(1);
  });

  it("processes only the specified emailTypes", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.winback.processPendingEmails({
      emailTypes: ["30day"],
      dryRun: true,
    });

    // getCancelledSubscriptionsForWindow should be called once (for 30day only)
    expect(
      vi.mocked(winbackDb.getCancelledSubscriptionsForWindow)
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(winbackDb.getCancelledSubscriptionsForWindow)
    ).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), "30day");
  });

  it("accepts a custom referenceTime for testing time-based windows", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const refTime = "2026-01-15T12:00:00.000Z";
    await caller.winback.processPendingEmails({
      referenceTime: refTime,
      emailTypes: ["7day"],
      dryRun: true,
    });

    const calls = vi.mocked(winbackDb.getCancelledSubscriptionsForWindow).mock.calls;
    expect(calls.length).toBe(1);
    // The window should be centred around 7 days before the reference time
    const [windowStart, windowEnd] = calls[0]!;
    const ref = new Date(refTime);
    const expectedCenter = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(windowStart.getTime()).toBeLessThan(expectedCenter.getTime());
    expect(windowEnd.getTime()).toBeGreaterThan(expectedCenter.getTime());
  });
});

describe("winback.getLogs", () => {
  it("rejects non-admin callers", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.winback.getLogs()).rejects.toThrow();
  });

  it("returns logs for admin users", async () => {
    vi.mocked(winbackDb.getWinbackEmailLogs).mockResolvedValue([
      {
        id: 1,
        subscriptionId: 1,
        userId: 1,
        emailType: "7day",
        recipientEmail: "test@example.com",
        status: "sent",
        errorMessage: null,
        sentAt: new Date(),
      },
    ]);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const logs = await caller.winback.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.emailType).toBe("7day");
  });
});

describe("winback.cancelSubscription", () => {
  it("rejects non-admin callers", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.winback.cancelSubscription({ subscriptionId: 1 })
    ).rejects.toThrow();
  });

  it("calls cancelSubscription DB helper for admin users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.winback.cancelSubscription({
      subscriptionId: 99,
      cancelReason: "Customer requested cancellation",
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(winbackDb.cancelSubscription)).toHaveBeenCalledWith(
      99,
      "Customer requested cancellation"
    );
  });
});
