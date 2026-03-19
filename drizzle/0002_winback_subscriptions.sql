-- Migration: Add subscriptions and winback_emails tables for win-back email campaign
-- Generated: 2026-03-19

CREATE TABLE `subscriptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `userEmail` varchar(320) NOT NULL,
  `userName` varchar(255),
  `plan` varchar(100) NOT NULL DEFAULT 'standard',
  `status` enum('active','cancelled','expired','paused') NOT NULL DEFAULT 'active',
  `cancelledAt` timestamp,
  `cancelReason` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `winback_emails` (
  `id` int AUTO_INCREMENT NOT NULL,
  `subscriptionId` int NOT NULL,
  `userId` int NOT NULL,
  `userEmail` varchar(320) NOT NULL,
  `userName` varchar(255),
  `emailType` enum('7day','30day') NOT NULL,
  `scheduledAt` timestamp NOT NULL,
  `sentAt` timestamp,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `errorMessage` text,
  `retryCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `winback_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- Index for efficient pending email queries
CREATE INDEX `winback_emails_status_scheduledAt_idx` ON `winback_emails` (`status`, `scheduledAt`);
--> statement-breakpoint

-- Index for subscription lookup by userId
CREATE INDEX `subscriptions_userId_idx` ON `subscriptions` (`userId`);
--> statement-breakpoint

-- Index for subscription lookup by status
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);
