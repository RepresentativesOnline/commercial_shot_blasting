import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Gallery items table for before/after shot blasting work
 */
export const galleryItems = mysqlTable("gallery_items", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  beforeImage: text("beforeImage").notNull(),
  afterImage: text("afterImage").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = typeof galleryItems.$inferInsert;

/**
 * Testimonials table for customer reviews
 */
export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  rating: int("rating").default(5).notNull(),
  text: text("text").notNull(),
  project: varchar("project", { length: 255 }),
  images: text("images"), // JSON array of image URLs
  isNew: boolean("isNew").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

/**
 * Contact form submissions
 */
export const contactSubmissions = mysqlTable("contact_submissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "replied", "archived"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

/**
 * CMS Pages table for managing site pages
 */
export const cmsPages = mysqlTable("cms_pages", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  metaDescription: text("metaDescription"),
  content: text("content").notNull(), // JSON content blocks
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = typeof cmsPages.$inferInsert;

/**
 * Page Content Sections table for WordPress-style content management
 * Each section represents an editable block on a page (hero, services, testimonials, etc.)
 */
export const pageContentSections = mysqlTable("page_content_sections", {
  id: int("id").autoincrement().primaryKey(),
  pageSlug: varchar("pageSlug", { length: 255 }).notNull(), // e.g., "home", "about", "services/structural-steel-frames"
  sectionKey: varchar("sectionKey", { length: 255 }).notNull(), // e.g., "hero", "services", "testimonials", "faq"
  sectionType: varchar("sectionType", { length: 100 }).notNull(), // e.g., "hero", "text", "list", "grid", "faq"
  content: text("content").notNull(), // JSON content for the section
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PageContentSection = typeof pageContentSections.$inferSelect;
export type InsertPageContentSection = typeof pageContentSections.$inferInsert;

/**
 * CMS Services table for managing service offerings
 */
export const cmsServices = mysqlTable("cms_services", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("shortDescription"),
  fullDescription: text("fullDescription"),
  icon: varchar("icon", { length: 100 }), // Icon name from lucide-react
  image: text("image"),
  features: text("features"), // JSON array of features
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsService = typeof cmsServices.$inferSelect;
export type InsertCmsService = typeof cmsServices.$inferInsert;

/**
 * CMS Settings table for site-wide configuration
 */
export const cmsSettings = mysqlTable("cms_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  type: mysqlEnum("type", ["text", "number", "boolean", "json"]).default("text").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsSetting = typeof cmsSettings.$inferSelect;
export type InsertCmsSetting = typeof cmsSettings.$inferInsert;

/**
 * CMS Hero Carousel Images table
 */
export const cmsHeroImages = mysqlTable("cms_hero_images", {
  id: int("id").autoincrement().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
  alt: varchar("alt", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsHeroImage = typeof cmsHeroImages.$inferSelect;
export type InsertCmsHeroImage = typeof cmsHeroImages.$inferInsert;

/**
 * Blog Posts table for managing blog articles
 */
export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  featuredImage: text("featuredImage").notNull(),
  author: varchar("author", { length: 255 }).default("Commercial Shot Blasting").notNull(),
  category: varchar("category", { length: 100 }),
  tags: text("tags"), // JSON array of tags
  metaDescription: text("metaDescription"),
  isPublished: boolean("isPublished").default(true).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

/**
 * Call Tracking Events table for measuring phone inquiry performance by location
 */
export const callTrackingEvents = mysqlTable("call_tracking_events", {
  id: int("id").autoincrement().primaryKey(),
  location: varchar("location", { length: 255 }).notNull(), // e.g., "Birmingham", "Leicester"
  phoneNumber: varchar("phoneNumber", { length: 50 }).notNull(),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  referrer: text("referrer"),
  userId: int("userId"), // Optional: link to user if authenticated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallTrackingEvent = typeof callTrackingEvents.$inferSelect;
export type InsertCallTrackingEvent = typeof callTrackingEvents.$inferInsert;

/**
 * Subscriptions table – tracks user subscription lifecycle including cancellations.
 * Win-back emails are triggered from this table when cancelledAt is set.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userEmail: varchar("userEmail", { length: 320 }).notNull(),
  userName: varchar("userName", { length: 255 }),
  plan: varchar("plan", { length: 100 }).notNull().default("standard"), // e.g. "standard", "pro", "enterprise"
  status: mysqlEnum("status", ["active", "cancelled", "expired", "paused"]).default("active").notNull(),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Win-back emails table – tracks scheduled and sent win-back emails.
 * A row is created for each email type (7-day, 30-day) when a subscription is cancelled.
 * Status transitions: pending → sent | failed
 */
export const winbackEmails = mysqlTable("winback_emails", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").notNull(),
  userId: int("userId").notNull(),
  userEmail: varchar("userEmail", { length: 320 }).notNull(),
  userName: varchar("userName", { length: 255 }),
  emailType: mysqlEnum("emailType", ["7day", "30day"]).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(), // When this email should be sent
  sentAt: timestamp("sentAt"),                     // Populated on successful send
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),              // Populated on failure
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WinbackEmail = typeof winbackEmails.$inferSelect;
export type InsertWinbackEmail = typeof winbackEmails.$inferInsert;
