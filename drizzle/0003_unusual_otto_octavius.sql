CREATE TABLE `competition_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`rulesText` text,
	`intentNotes` text,
	`expectedStartTime` varchar(8),
	`expectedEndTime` varchar(8),
	`expectedDurationMin` int,
	`requireAntiCopy` boolean DEFAULT true,
	`requireCaptcha` boolean DEFAULT false,
	`requireEmailVerification` boolean DEFAULT true,
	`requireCertificate` boolean DEFAULT true,
	`maxAttempts` int DEFAULT 1,
	`targetAgeGroup` varchar(64),
	`rawRulesJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competition_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historical_quiz_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`wpQuizId` int NOT NULL,
	`quizTitle` varchar(512),
	`settings` json NOT NULL,
	`notes` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historical_quiz_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_settings_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`connectionId` int NOT NULL,
	`rulesId` int,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`overallScore` float,
	`issuesFound` int DEFAULT 0,
	`warningsFound` int DEFAULT 0,
	`findings` json,
	`settingsSnapshot` json,
	`summary` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_settings_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int,
	`snapshotId` int,
	`participantName` varchar(255),
	`participantEmail` varchar(320),
	`videoUrl` text NOT NULL,
	`videoSource` enum('dropbox','google_drive','direct_url','email_attachment') NOT NULL DEFAULT 'direct_url',
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`verdict` enum('independent','suspicious','intervention'),
	`confidenceScore` float,
	`overallScore` float,
	`anomalies` json,
	`aiAnalysis` json,
	`summary` text,
	`reviewerNotes` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_verifications_id` PRIMARY KEY(`id`)
);
