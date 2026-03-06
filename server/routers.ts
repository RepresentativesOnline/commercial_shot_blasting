import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getActiveGalleryItems,
  getAllGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  getActiveTestimonials,
  getAllTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getContactSubmissions,
  createContactSubmission,
  updateContactSubmissionStatus,
  deleteContactSubmission,
  getPublishedBlogPosts,
  getAllBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getPageContentSections,
  getAllPageContentSections,
  getPageContentSection,
  createPageContentSection,
  updatePageContentSection,
  deletePageContentSection,
  upsertPageContentSection,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { sitemapRouter } from "./sitemap";
import { winbackRouter } from "./winbackRouter";

// Admin check middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  sitemap: sitemapRouter,
  winback: winbackRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Upload endpoint for S3 images
  upload: router({
    image: adminProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded
        contentType: z.string(),
        folder: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { fileName, fileData, contentType, folder = "gallery" } = input;
        
        // Decode base64 to buffer
        const buffer = Buffer.from(fileData, "base64");
        
        // Generate unique file key
        const ext = fileName.split(".").pop() || "jpg";
        const uniqueId = nanoid(10);
        const fileKey = `${folder}/${uniqueId}-${Date.now()}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, contentType);
        
        return { url, key: fileKey };
      }),

    // Upload with WebP variants for optimized loading
    imageWithWebP: adminProcedure
      .input(z.object({
        fileName: z.string(),
        mainData: z.string(), // Base64 encoded main image (JPEG)
        mainContentType: z.string(),
        webpData: z.string(), // Base64 encoded WebP version
        thumbnailData: z.string(), // Base64 encoded WebP thumbnail
        folder: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { fileName, mainData, mainContentType, webpData, thumbnailData, folder = "gallery" } = input;
        
        const uniqueId = nanoid(10);
        const timestamp = Date.now();
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        
        // Upload main image (JPEG)
        const mainBuffer = Buffer.from(mainData, "base64");
        const mainKey = `${folder}/${uniqueId}-${timestamp}.jpg`;
        const { url: mainUrl } = await storagePut(mainKey, mainBuffer, mainContentType);
        
        // Upload WebP version
        const webpBuffer = Buffer.from(webpData, "base64");
        const webpKey = `${folder}/${uniqueId}-${timestamp}.webp`;
        const { url: webpUrl } = await storagePut(webpKey, webpBuffer, "image/webp");
        
        // Upload thumbnail WebP
        const thumbBuffer = Buffer.from(thumbnailData, "base64");
        const thumbKey = `${folder}/${uniqueId}-${timestamp}-thumb.webp`;
        const { url: thumbnailUrl } = await storagePut(thumbKey, thumbBuffer, "image/webp");
        
        return { 
          url: mainUrl, 
          key: mainKey,
          webpUrl,
          webpKey,
          thumbnailUrl,
          thumbnailKey: thumbKey,
        };
      }),
  }),

  // Gallery Items
  gallery: router({
    // Public: Get active gallery items
    list: publicProcedure.query(async () => {
      return await getActiveGalleryItems();
    }),
    
    // Admin: Get all gallery items
    listAll: adminProcedure.query(async () => {
      return await getAllGalleryItems();
    }),
    
    // Admin: Create gallery item
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        category: z.string().min(1),
        description: z.string().optional(),
        beforeImage: z.string().url(),
        afterImage: z.string().url(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await createGalleryItem(input);
        return { success: true };
      }),
    
    // Admin: Update gallery item
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        description: z.string().optional(),
        beforeImage: z.string().url().optional(),
        afterImage: z.string().url().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateGalleryItem(id, data);
        return { success: true };
      }),
    
    // Admin: Delete gallery item
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteGalleryItem(input.id);
        return { success: true };
      }),
  }),

  // Testimonials
  testimonials: router({
    // Public: Get active testimonials
    list: publicProcedure.query(async () => {
      const items = await getActiveTestimonials();
      // Parse images JSON string to array
      return items.map(item => ({
        ...item,
        images: item.images ? JSON.parse(item.images) : [],
      }));
    }),
    
    // Admin: Get all testimonials
    listAll: adminProcedure.query(async () => {
      const items = await getAllTestimonials();
      return items.map(item => ({
        ...item,
        images: item.images ? JSON.parse(item.images) : [],
      }));
    }),
    
    // Admin: Create testimonial
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        company: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        text: z.string().min(1),
        project: z.string().optional(),
        images: z.array(z.string()).optional(),
        isNew: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { images, ...rest } = input;
        await createTestimonial({
          ...rest,
          images: images ? JSON.stringify(images) : null,
        });
        return { success: true };
      }),
    
    // Admin: Update testimonial
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        company: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        text: z.string().min(1).optional(),
        project: z.string().optional(),
        images: z.array(z.string()).optional(),
        isNew: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, images, ...rest } = input;
        await updateTestimonial(id, {
          ...rest,
          ...(images !== undefined ? { images: JSON.stringify(images) } : {}),
        });
        return { success: true };
      }),
    
    // Admin: Delete testimonial
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTestimonial(input.id);
        return { success: true };
      }),
  }),

  // Contact Form Submissions
  contact: router({
    // Public: Submit contact form
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        message: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await createContactSubmission(input);
        return { success: true };
      }),
    
    // Admin: Get all submissions
    list: adminProcedure.query(async () => {
      return await getContactSubmissions();
    }),
    
    // Admin: Update status
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "read", "replied", "archived"]),
      }))
      .mutation(async ({ input }) => {
        await updateContactSubmissionStatus(input.id, input.status);
        return { success: true };
      }),
    
    // Admin: Toggle read status
    toggleRead: adminProcedure
      .input(z.object({
        id: z.number(),
        isRead: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await updateContactSubmissionStatus(input.id, input.isRead ? "read" : "new");
        return { success: true };
      }),
    
    // Admin: Delete submission
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteContactSubmission(input.id);
        return { success: true };
      }),
  }),

  // Blog Posts
  blog: router({
    // Public: Get published blog posts
    list: publicProcedure.query(async () => {
      return await getPublishedBlogPosts();
    }),
    
    // Public: Get blog post by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return await getBlogPostBySlug(input.slug);
      }),
    
    // Admin: Get all blog posts
    listAll: adminProcedure.query(async () => {
      return await getAllBlogPosts();
    }),
    
    // Admin: Create blog post
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        title: z.string().min(1),
        excerpt: z.string().min(1),
        content: z.string().min(1),
        featuredImage: z.string().url(),
        author: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(), // JSON string
        metaDescription: z.string().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createBlogPost(input);
        return { success: true };
      }),
    
    // Admin: Update blog post
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        featuredImage: z.string().url().optional(),
        author: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(),
        metaDescription: z.string().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBlogPost(id, data);
        return { success: true };
      }),
    
    // Admin: Delete blog post
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBlogPost(input.id);
        return { success: true };
      }),
  }),

  // Call Tracking Analytics
  callTracking: router({
    // Log a call button click
    logCall: publicProcedure
      .input(z.object({
        location: z.string(),
        phoneNumber: z.string(),
        userAgent: z.string().optional(),
        referrer: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const { callTrackingEvents } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        await db.insert(callTrackingEvents).values({
          location: input.location,
          phoneNumber: input.phoneNumber,
          userAgent: input.userAgent,
          ipAddress: ctx.req.ip || ctx.req.socket.remoteAddress,
          referrer: input.referrer,
          userId: ctx.user?.id,
        });
        
        return { success: true };
      }),
    
    // Get call analytics (admin only)
    getAnalytics: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { callTrackingEvents } = await import("../drizzle/schema");
        const { sql, gte, lte, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        let conditions = [];
        if (input.startDate) {
          conditions.push(gte(callTrackingEvents.createdAt, new Date(input.startDate)));
        }
        if (input.endDate) {
          conditions.push(lte(callTrackingEvents.createdAt, new Date(input.endDate)));
        }
        
        const events = await db.select()
          .from(callTrackingEvents)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(callTrackingEvents.createdAt);
        
        return events;
      }),
    
    // Get call statistics by location (admin only)
    getLocationStats: adminProcedure
      .query(async () => {
        const { getDb } = await import("./db");
        const { callTrackingEvents } = await import("../drizzle/schema");
        const { sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        const stats = await db.select({
          location: callTrackingEvents.location,
          count: sql<number>`count(*)`
        })
        .from(callTrackingEvents)
        .groupBy(callTrackingEvents.location)
        .orderBy(sql`count(*) DESC`);
        
        return stats;
      }),
  }),

  // Page Content Management (WordPress-style CMS)
  pageContent: router({
    // Get all sections for a specific page
    getPageSections: publicProcedure
      .input(z.object({ pageSlug: z.string() }))
      .query(async ({ input }) => {
        return await getPageContentSections(input.pageSlug);
      }),
    
    // Get all page content sections (admin only)
    getAllSections: adminProcedure
      .query(async () => {
        return await getAllPageContentSections();
      }),
    
    // Get single section by ID (admin only)
    getSection: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getPageContentSection(input.id);
      }),
    
    // Create new page section (admin only)
    createSection: adminProcedure
      .input(z.object({
        pageSlug: z.string(),
        sectionKey: z.string(),
        sectionType: z.string(),
        content: z.string(), // JSON string
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        await createPageContentSection(input);
        return { success: true };
      }),
    
    // Update page section (admin only)
    updateSection: adminProcedure
      .input(z.object({
        id: z.number(),
        pageSlug: z.string().optional(),
        sectionKey: z.string().optional(),
        sectionType: z.string().optional(),
        content: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updatePageContentSection(id, updates);
        return { success: true };
      }),
    
    // Delete page section (admin only)
    deleteSection: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePageContentSection(input.id);
        return { success: true };
      }),
    
    // Upsert (create or update) page section (admin only)
    upsertSection: adminProcedure
      .input(z.object({
        pageSlug: z.string(),
        sectionKey: z.string(),
        sectionType: z.string(),
        content: z.string(), // JSON string
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { pageSlug, sectionKey, ...section } = input;
        await upsertPageContentSection(pageSlug, sectionKey, section);
        return { success: true };
      }),
    
    // Initialize Home page with default content (admin only, run once)
    initializeHomePage: adminProcedure
      .mutation(async () => {
        const homeSections = [
          {
            pageSlug: "home",
            sectionKey: "hero",
            sectionType: "hero",
            sortOrder: 1,
            isActive: true,
            content: JSON.stringify({
              title: "Professional Commercial Shot Blasting Services",
              subtitle: "Specialist precision shot blasting company in the UK, removing rust, scale, and coatings from all types of surfaces. Transform your surfaces with our expert team.",
              backgroundImages: [
                "/ShotBlastingSteelBeams.png",
                "/operator-blasting-gate.png",
                "/operator-warehouse-interior.png",
                "/hero-carousel-1.webp",
                "/hero-carousel-2.webp",
                "/hero-carousel-3.webp",
                "/hero-carousel-4.webp",
                "/hero-carousel-5.webp",
                "/hero-carousel-6.webp",
                "/hero-carousel-7.webp",
                "/hero-carousel-8.webp",
                "/hero-carousel-9.webp",
                "/hero-carousel-10.webp",
                "/hero-carousel-11.webp"
              ],
              ctaButtons: [
                { text: "Get a Free Quote Today", type: "primary", action: "openQuote" },
                { text: "View Our Work", type: "outline", link: "/gallery" },
                { text: "Call Now", type: "outline", link: "tel:07970566409", icon: "phone" }
              ]
            })
          },
          {
            pageSlug: "home",
            sectionKey: "service-selector",
            sectionType: "interactive",
            sortOrder: 2,
            isActive: true,
            content: JSON.stringify({
              eyebrow: "Find Your Perfect Service",
              title: "Not Sure Which Service You Need?",
              description: "Answer a few quick questions and we'll recommend the best shot blasting services for your specific project requirements."
            })
          },
          {
            pageSlug: "home",
            sectionKey: "services-grid",
            sectionType: "grid",
            sortOrder: 3,
            isActive: true,
            content: JSON.stringify({
              eyebrow: "Our Expert Services",
              title: "Comprehensive Shot Blasting Solutions",
              services: [
                {
                  title: "Structural Steel Frames",
                  description: "Comprehensive shot blasting for building frames, roof trusses, and load-bearing steel structures. Prepare surfaces for galvanizing or protective coatings.",
                  image: "/service-structural-steel.png",
                  link: "/services/structural-steel-frames"
                },
                {
                  title: "Fire Escapes & External Stair Towers",
                  description: "Specialist surface preparation for fire safety infrastructure. Remove rust and corrosion, ensuring compliance with safety regulations.",
                  image: "/service-fire-escapes.png",
                  link: "/services/fire-escapes"
                },
                {
                  title: "Internal Steel Staircases, Balustrades & Handrails",
                  description: "Precision shot blasting for architectural metalwork. Restore heritage features or prepare new fabrications for finishing.",
                  image: "/service-staircases.png",
                  link: "/services/staircases"
                },
                {
                  title: "Bridge Steelwork (Girders, Crossmembers, Parapet Rails)",
                  description: "Comprehensive surface preparation for bridge infrastructure. Meet highway and railway bridge coating specifications.",
                  image: "/service-bridge-steelwork.png",
                  link: "/services/bridge-steelwork"
                },
                {
                  title: "Crane Beams, Gantries & Runway Rails",
                  description: "Specialist surface preparation for material handling infrastructure. Preserve dimensional tolerances while removing rust and coatings.",
                  image: "/service-crane-beams.png",
                  link: "/services/crane-beams"
                },
                {
                  title: "Fixed Ladders & Step-Over Platforms",
                  description: "Comprehensive surface preparation for industrial access systems. Ensure compliance with working at height regulations.",
                  image: "/service-ladders.png",
                  link: "/services/ladders"
                },
                {
                  title: "Warehouse Racking & Pallet Rack Frames",
                  description: "Professional shot blasting for warehouse racking systems, pallet rack frames, and storage infrastructure.",
                  image: "/service-warehouse-racking.png",
                  link: "/services/warehouse-racking"
                },
                {
                  title: "Process Pipework, Spools & Manifolds",
                  description: "Precision cleaning of industrial pipework systems. Ideal for food processing, pharmaceutical, and chemical industries.",
                  image: "/service-pipework.png",
                  link: "/services/pipework"
                },
                {
                  title: "Telecom Masts & Lattice Towers",
                  description: "Specialist shot blasting for telecommunications infrastructure including masts, lattice towers, and antenna supports.",
                  image: "/service-telecom-tower.png",
                  link: "/services/telecom-towers"
                }
              ]
            })
          },
          {
            pageSlug: "home",
            sectionKey: "about",
            sectionType: "text-image",
            sortOrder: 4,
            isActive: true,
            content: JSON.stringify({
              eyebrow: "Why Choose Us",
              title: "A Business You Can Trust",
              paragraphs: [
                "We are a trusted family-run business with the mission to provide superior shot blasting solutions for industrial and commercial environments across the UK. Our advanced shot blasting technology delivers exceptional results at competitive prices.",
                "As part of our commitment, we employ an expert team dedicated to providing unparalleled services while maintaining high safety standards that protect both your property and our environment."
              ],
              features: [
                { icon: "Shield", text: "Fully Insured" },
                { icon: "Award", text: "Industry Certified" },
                { icon: "Clock", text: "Fast Turnaround" },
                { icon: "Users", text: "Expert Team" }
              ],
              beforeAfterSlider: {
                beforeImage: "/warehouse-before.jpg",
                afterImage: "/warehouse-after.jpg",
                beforeLabel: "Before: Rusted & Corroded",
                afterLabel: "After: Shot Blasted"
              },
              badge: {
                number: "20+",
                text: "Years Experience"
              }
            })
          },
          {
            pageSlug: "home",
            sectionKey: "contact-cta",
            sectionType: "cta",
            sortOrder: 5,
            isActive: true,
            content: JSON.stringify({
              title: "Get Your Free Quote Today",
              description: "Contact us now for a no-obligation quote. Our expert team is ready to discuss your shot blasting requirements.",
              leftColumn: {
                title: "Why Choose Us?",
                benefits: [
                  { icon: "Clock", text: "24-Hour Response Time" },
                  { icon: "Shield", text: "Fully Insured & Certified" },
                  { icon: "Award", text: "Competitive Pricing" },
                  { icon: "MapPin", text: "Nationwide Coverage" }
                ]
              },
              contactInfo: [
                { icon: "Phone", label: "Phone", value: "07970 566409", link: "tel:07970566409" },
                { icon: "Mail", label: "Email", value: "info@commercialshotblasting.co.uk", link: "mailto:info@commercialshotblasting.co.uk" },
                { icon: "MapPin", label: "Service Area", value: "Nationwide UK Coverage" }
              ]
            })
          }
        ];

        for (const section of homeSections) {
          await upsertPageContentSection(section.pageSlug, section.sectionKey, {
            sectionType: section.sectionType,
            content: section.content,
            sortOrder: section.sortOrder,
            isActive: section.isActive
          });
        }

        return { success: true, message: "Home page content initialized successfully" };
      }),
  }),
});

export type AppRouter = typeof appRouter;
