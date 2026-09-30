PRAGMA defer_foreign_keys=true;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Products of organizations deleted before this FK existed (products had none)
-- would fail the deferred check at COMMIT and roll the whole migration back.
DELETE FROM products WHERE organization_id NOT IN (SELECT id FROM organization);--> statement-breakpoint
INSERT INTO `__new_products`("id", "organization_id", "name", "description", "price", "created_at", "updated_at") SELECT "id", "organization_id", "name", "description", "price", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE INDEX `products_organizationId_idx` ON `products` (`organization_id`);