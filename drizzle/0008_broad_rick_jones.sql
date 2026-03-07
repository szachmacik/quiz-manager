CREATE TABLE `risk_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`riskItemId` int NOT NULL,
	`anomalyCaseId` int,
	`simulationId` int,
	`description` text NOT NULL,
	`resolvedBy` text,
	`resolutionTimeMinutes` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `risk_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('wordpress_core','ays_plugin','server_infra','network','user_behavior','competition_setup','recording','native_migration','offline_contest') NOT NULL,
	`platform` enum('wordpress','native','both','offline') NOT NULL DEFAULT 'wordpress',
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`scenario` text,
	`probability` enum('low','medium','high','certain') NOT NULL,
	`impact` enum('low','medium','high','critical') NOT NULL,
	`riskScore` int NOT NULL,
	`isWordPressSpecific` boolean DEFAULT false,
	`isUnavoidable` boolean DEFAULT false,
	`immediateAction` text NOT NULL,
	`prevention` text NOT NULL,
	`nativeSolution` text,
	`checklistItems` json,
	`status` enum('active','mitigated','resolved','monitoring') NOT NULL DEFAULT 'active',
	`lastOccurredAt` timestamp,
	`occurrenceCount` int DEFAULT 0,
	`isBuiltIn` boolean DEFAULT false,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risk_items_id` PRIMARY KEY(`id`)
);
