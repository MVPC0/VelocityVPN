CREATE TABLE `email_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(255),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`verified` boolean NOT NULL DEFAULT false,
	`verification_code` varchar(10),
	`verify_attempts` int NOT NULL DEFAULT 0,
	`code_expires_at` timestamp,
	`trial_started_at` timestamp,
	`trial_days` int NOT NULL DEFAULT 3,
	`is_subscribed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`last_sign_in_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `game_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`game_name` varchar(100) NOT NULL,
	`event_name` varchar(200) NOT NULL,
	`description` text,
	`multiplier` int NOT NULL DEFAULT 100,
	`start_date` timestamp NOT NULL,
	`end_date` timestamp NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ping_results` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`server_id` bigint unsigned NOT NULL,
	`latency` int NOT NULL,
	`jitter` int DEFAULT 0,
	`packet_loss` int DEFAULT 0,
	`measured_from` varchar(50) DEFAULT 'api',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ping_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `server_monitoring` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`latency` int NOT NULL,
	`player_count` int NOT NULL DEFAULT 0,
	`load_percent` int NOT NULL DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_monitoring_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`server_id` bigint unsigned NOT NULL,
	`status` enum('connected','disconnected','connecting','error') NOT NULL DEFAULT 'disconnected',
	`client_ip` varchar(45),
	`assigned_ip` varchar(45),
	`protocol` varchar(20) DEFAULT 'wireguard',
	`bytes_sent` bigint DEFAULT 0,
	`bytes_received` bigint DEFAULT 0,
	`connected_at` timestamp,
	`disconnected_at` timestamp,
	`duration` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
CREATE TABLE `vpn_servers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`country` varchar(100) NOT NULL,
	`country_code` varchar(2) NOT NULL,
	`region` varchar(50) NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`port` int NOT NULL DEFAULT 51820,
	`protocol` enum('wireguard','openvpn_udp','openvpn_tcp','ikev2') NOT NULL DEFAULT 'wireguard',
	`public_key` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`load` int NOT NULL DEFAULT 0,
	`max_clients` int NOT NULL DEFAULT 1000,
	`lat` varchar(20),
	`lng` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vpn_servers_id` PRIMARY KEY(`id`)
);
