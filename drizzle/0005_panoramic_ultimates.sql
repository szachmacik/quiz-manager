CREATE TABLE `award_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`awardId` int,
	`awardName` varchar(512) NOT NULL,
	`contestEdition` varchar(128) NOT NULL,
	`contestName` varchar(512),
	`shippedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `award_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `awards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`description` text,
	`category` varchar(128),
	`ageGroup` varchar(64),
	`imageUrl` text,
	`stockCount` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `awards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contest_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contestName` varchar(512) NOT NULL,
	`contestEdition` varchar(128),
	`snapshotId` int,
	`participantId` int,
	`participantName` varchar(255),
	`participantEmail` varchar(320),
	`schoolId` int,
	`ageGroup` varchar(64),
	`score` float NOT NULL,
	`correctAnswers` int DEFAULT 0,
	`totalQuestions` int DEFAULT 0,
	`completionTimeMs` bigint,
	`rank` int,
	`isWinner` boolean DEFAULT false,
	`isLaureate` boolean DEFAULT false,
	`videoVerificationId` int,
	`telemetrySessionId` int,
	`verificationStatus` enum('pending','verified','rejected','manual_review') DEFAULT 'pending',
	`source` enum('wp_quiz','manual','import_csv','import_mailerlite','import_facebook') DEFAULT 'wp_quiz',
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contest_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`schoolId` int,
	`grade` varchar(32),
	`ageGroup` varchar(64),
	`mailerLiteId` varchar(128),
	`mailerLiteData` json,
	`totalPackagesReceived` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`address` text,
	`city` varchar(255),
	`postalCode` varchar(16),
	`country` varchar(64) DEFAULT 'PL',
	`teacherName` varchar(255),
	`teacherEmail` varchar(320),
	`teacherPhone` varchar(32),
	`mailerLiteGroupId` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contestEdition` varchar(128) NOT NULL,
	`schoolId` int NOT NULL,
	`schoolName` varchar(512),
	`recipientCount` int DEFAULT 0,
	`recipientIds` json,
	`awardIds` json,
	`shippingAddress` text,
	`teacherName` varchar(255),
	`teacherEmail` varchar(320),
	`status` enum('draft','ready','shipped','delivered') NOT NULL DEFAULT 'draft',
	`trackingNumber` varchar(128),
	`hasNewAwardNeeded` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_batches_id` PRIMARY KEY(`id`)
);
