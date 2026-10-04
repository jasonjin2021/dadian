CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_created` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `room_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`match_number` integer NOT NULL,
	`round_number` integer NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_room_events_room_created` ON `room_events` (`room_code`,`created_at`);--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`seat` integer,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_room_members_room_session` ON `room_members` (`room_code`,`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_room_members_room_seat` ON `room_members` (`room_code`,`seat`);--> statement-breakpoint
CREATE INDEX `idx_room_members_room` ON `room_members` (`room_code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`host_session_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`state_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_updated_at` ON `rooms` (`updated_at`);