CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`sigla` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`numeracion_mode` text DEFAULT 'hereda' NOT NULL,
	`reinicia_anualmente` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_sigla_unique` ON `areas` (`sigla`);--> statement-breakpoint
CREATE INDEX `areas_parent_id_index` ON `areas` (`parent_id`);--> statement-breakpoint
CREATE TABLE `contadores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_owner_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`year` integer,
	`ciclo` integer DEFAULT 1 NOT NULL,
	`ultimo_numero` integer DEFAULT 0 NOT NULL,
	`reset_glosa` text,
	`ultimo_reset_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`area_owner_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contadores_owner_tipo_year_unique` ON `contadores` (`area_owner_id`,`tipo`,`year`);--> statement-breakpoint
CREATE TABLE `document_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documento_id` integer NOT NULL,
	`nombre_original` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`contador_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`year` integer NOT NULL,
	`ciclo` integer NOT NULL,
	`numero` integer NOT NULL,
	`nro_completo` text NOT NULL,
	`referencia` text NOT NULL,
	`descripcion` text,
	`destinatario_user_id` integer,
	`destinatario_texto` text,
	`fecha_documento` integer NOT NULL,
	`creado_por` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contador_id`) REFERENCES `contadores`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`destinatario_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creado_por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documentos_contador_ciclo_numero_unique` ON `documentos` (`contador_id`,`ciclo`,`numero`);--> statement-breakpoint
CREATE INDEX `documentos_area_tipo_fecha_index` ON `documentos` (`area_id`,`tipo`,`fecha_documento`);--> statement-breakpoint
CREATE INDEX `documentos_creado_por_index` ON `documentos` (`creado_por`);--> statement-breakpoint
CREATE INDEX `documentos_contador_id_index` ON `documentos` (`contador_id`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`ip` text NOT NULL,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `module_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`module` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `module_assignments_user_module_unique` ON `module_assignments` (`user_id`,`module`);--> statement-breakpoint
CREATE TABLE `puestos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`area_id` integer NOT NULL,
	`name` text NOT NULL,
	`sigla` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `puestos_area_id_index` ON `puestos` (`area_id`);--> statement-breakpoint
CREATE TABLE `resets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contador_id` integer NOT NULL,
	`realizado_por` integer NOT NULL,
	`glosa` text NOT NULL,
	`numero_anterior` integer DEFAULT 0 NOT NULL,
	`numero_nuevo` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`contador_id`) REFERENCES `contadores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`realizado_por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`area_id` integer NOT NULL,
	`puesto_id` integer,
	`fecha_inicio` integer NOT NULL,
	`fecha_fin` integer,
	`activa` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`puesto_id`) REFERENCES `puestos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_areas_active_unique` ON `user_areas` (`user_id`) WHERE "user_areas"."activa" = 1;--> statement-breakpoint
CREATE INDEX `user_areas_user_id_index` ON `user_areas` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_areas_area_id_index` ON `user_areas` (`area_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);