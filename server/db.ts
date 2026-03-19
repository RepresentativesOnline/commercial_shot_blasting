import { eq, desc, asc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  galleryItems, 
  InsertGalleryItem, 
  GalleryItem,
  testimonials, 
  InsertTestimonial, 
  Testimonial,
  contactSubmissions, 
  InsertContactSubmission, 
  ContactSubmission,
  blogPosts,
  InsertBlogPost,
  BlogPost,
  pageContentSections,
  InsertPageContentSection,
  PageContentSection,
  subscriptions,
  InsertSubscription,
  Subscription,
  winbackEmails,
  InsertWinbackEmail,
  WinbackEmail,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Gallery Items ====================

export async function getActiveGalleryItems(): Promise<GalleryItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(galleryItems)
    .where(eq(galleryItems.isActive, true))
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt));
  
  return result;
}

export async function getAllGalleryItems(): Promise<GalleryItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(galleryItems)
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt));
  
  return result;
}

export async function createGalleryItem(item: InsertGalleryItem): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(galleryItems).values(item);
}

export async function updateGalleryItem(id: number, item: Partial<InsertGalleryItem>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(galleryItems).set(item).where(eq(galleryItems.id, id));
}

export async function deleteGalleryItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(galleryItems).where(eq(galleryItems.id, id));
}

// ==================== Testimonials ====================

export async function getActiveTestimonials(): Promise<Testimonial[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.isActive, true))
    .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt));
  
  return result;
}

export async function getAllTestimonials(): Promise<Testimonial[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(testimonials)
    .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt));
  
  return result;
}

export async function createTestimonial(item: InsertTestimonial): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(testimonials).values(item);
}

export async function updateTestimonial(id: number, item: Partial<InsertTestimonial>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(testimonials).set(item).where(eq(testimonials.id, id));
}

export async function deleteTestimonial(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(testimonials).where(eq(testimonials.id, id));
}

// ==================== Contact Submissions ====================

export async function getContactSubmissions(): Promise<ContactSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt));
  
  return result;
}

export async function createContactSubmission(submission: InsertContactSubmission): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(contactSubmissions).values(submission);
}

export async function updateContactSubmissionStatus(
  id: number, 
  status: "new" | "read" | "replied" | "archived"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contactSubmissions).set({ status }).where(eq(contactSubmissions.id, id));
}

export async function deleteContactSubmission(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contactSubmissions).where(eq(contactSubmissions.id, id));
}

// ==================== Blog Posts ====================

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.isPublished, true))
    .orderBy(desc(blogPosts.publishedAt));
  
  return result;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(blogPosts)
    .orderBy(desc(blogPosts.createdAt));
  
  return result;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  
  return result[0];
}

export async function createBlogPost(post: InsertBlogPost): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(blogPosts).values(post);
}

export async function updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(blogPosts).set(post).where(eq(blogPosts.id, id));
}

export async function deleteBlogPost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

// ==================== Page Content Sections ====================

export async function getPageContentSections(pageSlug: string): Promise<PageContentSection[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(pageContentSections)
    .where(eq(pageContentSections.pageSlug, pageSlug))
    .orderBy(asc(pageContentSections.sortOrder));
  
  return result;
}

export async function getAllPageContentSections(): Promise<PageContentSection[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(pageContentSections)
    .orderBy(asc(pageContentSections.pageSlug), asc(pageContentSections.sortOrder));
  
  return result;
}

export async function getPageContentSection(id: number): Promise<PageContentSection | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(pageContentSections)
    .where(eq(pageContentSections.id, id))
    .limit(1);
  
  return result[0];
}

export async function createPageContentSection(section: InsertPageContentSection): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(pageContentSections).values(section);
}

export async function updatePageContentSection(id: number, section: Partial<InsertPageContentSection>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(pageContentSections).set(section).where(eq(pageContentSections.id, id));
}

export async function deletePageContentSection(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(pageContentSections).where(eq(pageContentSections.id, id));
}

export async function upsertPageContentSection(
  pageSlug: string,
  sectionKey: string,
  section: Omit<InsertPageContentSection, 'pageSlug' | 'sectionKey'>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if section exists
  const existing = await db
    .select()
    .from(pageContentSections)
    .where(and(
      eq(pageContentSections.pageSlug, pageSlug),
      eq(pageContentSections.sectionKey, sectionKey)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing
    await db
      .update(pageContentSections)
      .set(section)
      .where(eq(pageContentSections.id, existing[0].id));
  } else {
    // Insert new
    await db.insert(pageContentSections).values({
      pageSlug,
      sectionKey,
      ...section
    });
  }
}

// ==================== Subscriptions ====================

export async function createSubscription(sub: InsertSubscription): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(subscriptions).values(sub);
}

export async function getSubscriptionById(id: number): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return result[0];
}

export async function getCancelledSubscriptions(): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.status, "cancelled"))
    .orderBy(desc(subscriptions.cancelledAt));
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

// ==================== Win-back Emails ====================

/**
 * Schedule the two win-back emails (7-day and 30-day) for a newly cancelled subscription.
 * Idempotent: skips creation if a row already exists for the same subscription + emailType.
 */
export async function scheduleWinbackEmails(subscriptionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sub = await getSubscriptionById(subscriptionId);
  if (!sub || !sub.cancelledAt) {
    throw new Error(`Subscription ${subscriptionId} not found or not cancelled`);
  }

  const cancelledAt = sub.cancelledAt;

  const sevenDaySchedule = new Date(cancelledAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaySchedule = new Date(cancelledAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const emailTypes: Array<{ emailType: "7day" | "30day"; scheduledAt: Date }> = [
    { emailType: "7day", scheduledAt: sevenDaySchedule },
    { emailType: "30day", scheduledAt: thirtyDaySchedule },
  ];

  for (const { emailType, scheduledAt } of emailTypes) {
    // Check for existing row to ensure idempotency
    const existing = await db
      .select()
      .from(winbackEmails)
      .where(
        and(
          eq(winbackEmails.subscriptionId, subscriptionId),
          eq(winbackEmails.emailType, emailType)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(winbackEmails).values({
        subscriptionId,
        userId: sub.userId,
        userEmail: sub.userEmail,
        userName: sub.userName ?? null,
        emailType,
        scheduledAt,
        status: "pending",
        retryCount: 0,
      });
    }
  }
}

/**
 * Fetch all win-back emails that are due to be sent (scheduledAt <= now, status = pending).
 */
export async function getPendingWinbackEmails(): Promise<WinbackEmail[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  // Drizzle MySQL does not expose a lte helper directly; use raw SQL comparison via sql tag
  // Instead we fetch all pending and filter in JS to avoid importing sql tag
  const allPending = await db
    .select()
    .from(winbackEmails)
    .where(eq(winbackEmails.status, "pending"))
    .orderBy(asc(winbackEmails.scheduledAt));

  return allPending.filter((row) => row.scheduledAt <= now);
}

export async function markWinbackEmailSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(winbackEmails)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(winbackEmails.id, id));
}

export async function markWinbackEmailFailed(id: number, errorMessage: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(winbackEmails).where(eq(winbackEmails.id, id)).limit(1);
  const currentRetryCount = existing[0]?.retryCount ?? 0;

  await db
    .update(winbackEmails)
    .set({
      status: "failed",
      errorMessage,
      retryCount: currentRetryCount + 1,
    })
    .where(eq(winbackEmails.id, id));
}

export async function createWinbackEmail(email: InsertWinbackEmail): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(winbackEmails).values(email);
}
