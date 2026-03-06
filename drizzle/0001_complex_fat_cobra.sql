CREATE TABLE `ai_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`overallScore` float,
	`errorsFound` int DEFAULT 0,
	`warningsFound` int DEFAULT 0,
	`summary` text,
	`findings` json,
	`rawResponse` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patch_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`aiReviewId` int,
	`title` varchar(512) NOT NULL,
	`description` text,
	`patchType` enum('question_text','answer_text','correct_answer','settings','other') NOT NULL,
	`targetWpId` int,
	`targetType` enum('question','answer','quiz'),
	`fieldName` varchar(128),
	`originalValue` text,
	`proposedValue` text,
	`reasoning` text,
	`status` enum('pending','approved','rejected','applied','rolled_back') NOT NULL DEFAULT 'pending',
	`preApplySnapshotId` int,
	`postSimulationId` int,
	`approvedBy` varchar(64),
	`approvedAt` timestamp,
	`appliedAt` timestamp,
	`rolledBackAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patch_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`snapshotId` int NOT NULL,
	`wpAnswerId` int NOT NULL,
	`answer` text NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`position` int DEFAULT 0,
	CONSTRAINT `quiz_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`wpQuestionId` int NOT NULL,
	`question` text NOT NULL,
	`type` enum('radio','checkbox','select','text') NOT NULL DEFAULT 'radio',
	`position` int DEFAULT 0,
	`rawData` json,
	CONSTRAINT `quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`wpQuizId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`slug` varchar(512),
	`shortcode` varchar(128),
	`settings` json,
	`questionIds` text,
	`questionCount` int DEFAULT 0,
	`snapshotType` enum('auto','manual','pre_test','pre_patch') NOT NULL DEFAULT 'auto',
	`snapshotHash` varchar(64),
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int,
	`simulationId` int,
	`aiReviewId` int,
	`title` varchar(512) NOT NULL,
	`type` enum('simulation','ai_review','combined','patch_summary') NOT NULL,
	`content` json,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulation_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`simulationId` int NOT NULL,
	`agentIndex` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`score` float,
	`responseMs` float,
	`httpStatus` int,
	`errorMessage` text,
	`answers` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `simulation_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`connectionId` int NOT NULL,
	`name` varchar(255),
	`agentCount` int NOT NULL DEFAULT 100,
	`agentDomain` varchar(255) NOT NULL,
	`strategy` enum('random','all_correct','all_wrong','mixed') NOT NULL DEFAULT 'random',
	`concurrency` int NOT NULL DEFAULT 10,
	`delayMs` int DEFAULT 500,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`totalAgents` int DEFAULT 0,
	`completedAgents` int DEFAULT 0,
	`failedAgents` int DEFAULT 0,
	`avgResponseMs` float,
	`minResponseMs` float,
	`maxResponseMs` float,
	`p95ResponseMs` float,
	`errorRate` float,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wp_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`siteUrl` varchar(512) NOT NULL,
	`apiUser` varchar(255) NOT NULL,
	`apiPassword` text NOT NULL,
	`mysqlHost` varchar(255),
	`mysqlPort` int DEFAULT 3306,
	`mysqlDb` varchar(255),
	`mysqlUser` varchar(255),
	`mysqlPassword` text,
	`tablePrefix` varchar(32) DEFAULT 'wp_',
	`status` enum('active','error','untested') NOT NULL DEFAULT 'untested',
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wp_connections_id` PRIMARY KEY(`id`)
);
