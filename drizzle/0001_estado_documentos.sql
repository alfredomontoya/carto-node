ALTER TABLE `documentos` ADD `estado` text DEFAULT 'activo' NOT NULL;--> statement-breakpoint
ALTER TABLE `documentos` DROP COLUMN `deleted_at`;