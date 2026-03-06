CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`snapshotId` int NOT NULL,
	`connectionId` int NOT NULL,
	`agentDomain` varchar(255) NOT NULL,
	`agentCount` int NOT NULL DEFAULT 100,
	`concurrency` int NOT NULL DEFAULT 10,
	`delayMs` int DEFAULT 500,
	`strategy` enum('random','all_correct','all_wrong','mixed') NOT NULL DEFAULT 'random',
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','triggered','cancelled') NOT NULL DEFAULT 'pending',
	`triggeredSimulationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_simulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snapshot_diffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotAId` int NOT NULL,
	`snapshotBId` int NOT NULL,
	`addedQuestions` int DEFAULT 0,
	`removedQuestions` int DEFAULT 0,
	`modifiedQuestions` int DEFAULT 0,
	`addedAnswers` int DEFAULT 0,
	`removedAnswers` int DEFAULT 0,
	`modifiedAnswers` int DEFAULT 0,
	`diffData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `snapshot_diffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`wpQuizId` int,
	`status` enum('ok','changed','error','no_change') NOT NULL DEFAULT 'ok',
	`snapshotId` int,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_log_id` PRIMARY KEY(`id`)
);
