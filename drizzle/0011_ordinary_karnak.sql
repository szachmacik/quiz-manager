CREATE TABLE `mailer_lite_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`totalImported` int NOT NULL DEFAULT 0,
	`totalUpdated` int NOT NULL DEFAULT 0,
	`totalSkipped` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`errorMessage` text,
	`importedBy` int,
	CONSTRAINT `mailer_lite_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pre_contest_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int,
	`quizId` varchar(64),
	`contestName` varchar(255),
	`scheduledAt` timestamp,
	`checkResults` json,
	`overallStatus` enum('pass','warn','fail','pending') NOT NULL DEFAULT 'pending',
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`runBy` int,
	CONSTRAINT `pre_contest_checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_history_timeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`quizId` varchar(64) NOT NULL,
	`quizTitle` varchar(255),
	`eventType` enum('snapshot_created','ai_review_started','ai_review_completed','simulation_started','simulation_completed','patch_proposed','patch_approved','patch_rejected','patch_applied','patch_rolled_back','settings_audited','video_verified','anomaly_detected','test_page_created','sync_detected_change') NOT NULL,
	`eventData` json,
	`userId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_history_timeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webpush_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webpush_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mailer_lite_imports` ADD CONSTRAINT `mailer_lite_imports_importedBy_users_id_fk` FOREIGN KEY (`importedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pre_contest_checklists` ADD CONSTRAINT `pre_contest_checklists_runBy_users_id_fk` FOREIGN KEY (`runBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quiz_history_timeline` ADD CONSTRAINT `quiz_history_timeline_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webpush_subscriptions` ADD CONSTRAINT `webpush_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;