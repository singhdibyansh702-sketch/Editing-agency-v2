-- Video Editing Agency Management System
-- Relational SQLite Schema (Matching MySQL 8.0 DDL)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS `users` (
  `id` TEXT PRIMARY KEY,
  `email` TEXT NOT NULL UNIQUE,
  `password_hash` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `role` TEXT NOT NULL CHECK(`role` IN ('ADMIN', 'EDITOR', 'CLIENT')),
  `status` TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(`status` IN ('ACTIVE', 'INACTIVE')),
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at` TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_users_role` ON `users` (`role`);
CREATE INDEX IF NOT EXISTS `idx_users_status` ON `users` (`status`);

CREATE TABLE IF NOT EXISTS `client_profiles` (
  `id` TEXT PRIMARY KEY,
  `user_id` TEXT NOT NULL UNIQUE,
  `phone` TEXT DEFAULT NULL,
  `company_name` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `editor_profiles` (
  `id` TEXT PRIMARY KEY,
  `user_id` TEXT NOT NULL UNIQUE,
  `phone` TEXT DEFAULT NULL,
  `skills` TEXT DEFAULT NULL,
  `experience` TEXT DEFAULT NULL,
  `portfolio_link` TEXT DEFAULT NULL,
  `payment_rate` REAL NOT NULL DEFAULT 0.00,
  `internal_notes` TEXT DEFAULT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `projects` (
  `id` TEXT PRIMARY KEY,
  `project_code` TEXT NOT NULL UNIQUE,
  `title` TEXT NOT NULL,
  `description` TEXT DEFAULT NULL,
  `video_type` TEXT NOT NULL,
  `editing_requirements` TEXT DEFAULT NULL,
  `reference_link` TEXT DEFAULT NULL,
  `spec_doc_url` TEXT DEFAULT NULL,
  `currency` TEXT NOT NULL DEFAULT 'USD',
  `client_budget` REAL DEFAULT NULL,
  `client_price` REAL NOT NULL DEFAULT 0.00,
  `admin_quote_note` TEXT DEFAULT NULL,
  `client_id` TEXT NOT NULL,
  `editor_id` TEXT DEFAULT NULL,
  `editor_payment` REAL NOT NULL DEFAULT 0.00,
  `status` TEXT NOT NULL DEFAULT 'Pending Approval',
  `deadline` TEXT DEFAULT NULL,
  `start_date` TEXT DEFAULT NULL,
  `final_delivery_link` TEXT DEFAULT NULL,
  `client_approved_at` TEXT DEFAULT NULL,
  `client_revision_notes` TEXT DEFAULT NULL,
  `advance_payment_status` TEXT NOT NULL DEFAULT 'NONE',
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`editor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS `idx_projects_status` ON `projects` (`status`);
CREATE INDEX IF NOT EXISTS `idx_projects_client_id` ON `projects` (`client_id`);
CREATE INDEX IF NOT EXISTS `idx_projects_editor_id` ON `projects` (`editor_id`);

CREATE TABLE IF NOT EXISTS `project_submissions` (
  `id` TEXT PRIMARY KEY,
  `project_id` TEXT NOT NULL,
  `editor_id` TEXT NOT NULL,
  `submission_link` TEXT NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `status` TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`editor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_submissions_project` ON `project_submissions` (`project_id`);
CREATE INDEX IF NOT EXISTS `idx_submissions_editor` ON `project_submissions` (`editor_id`);

CREATE TABLE IF NOT EXISTS `payments` (
  `id` TEXT PRIMARY KEY,
  `project_id` TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `amount` REAL NOT NULL,
  `currency` TEXT NOT NULL DEFAULT 'USD',
  `payment_method` TEXT NOT NULL,
  `payment_date` TEXT NOT NULL,
  `reference_id` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `status` TEXT NOT NULL DEFAULT 'VERIFIED',
  `payer_user_id` TEXT DEFAULT NULL,
  `receipt_url` TEXT DEFAULT NULL,
  `deduction_amount` REAL NOT NULL DEFAULT 0.00,
  `deduction_reason` TEXT DEFAULT NULL,
  `verified_at` TEXT DEFAULT NULL,
  `verified_by` TEXT DEFAULT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_payments_project` ON `payments` (`project_id`);
CREATE INDEX IF NOT EXISTS `idx_payments_type` ON `payments` (`type`);

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` TEXT PRIMARY KEY,
  `user_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `link` TEXT DEFAULT NULL,
  `is_read` INTEGER NOT NULL DEFAULT 0,
  `type` TEXT NOT NULL DEFAULT 'INFO',
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_notifications_user` ON `notifications` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_notifications_read` ON `notifications` (`is_read`);

CREATE TABLE IF NOT EXISTS `direct_messages` (
  `id` TEXT PRIMARY KEY,
  `sender_id` TEXT NOT NULL,
  `receiver_id` TEXT NOT NULL,
  `project_id` TEXT DEFAULT NULL,
  `message` TEXT NOT NULL,
  `is_read` INTEGER NOT NULL DEFAULT 0,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS `idx_dm_sender` ON `direct_messages` (`sender_id`);
CREATE INDEX IF NOT EXISTS `idx_dm_receiver` ON `direct_messages` (`receiver_id`);
CREATE INDEX IF NOT EXISTS `idx_dm_project` ON `direct_messages` (`project_id`);

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` TEXT PRIMARY KEY,
  `user_id` TEXT DEFAULT NULL,
  `action` TEXT NOT NULL,
  `resource_type` TEXT NOT NULL,
  `resource_id` TEXT DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` TEXT DEFAULT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS `idx_audit_user` ON `audit_logs` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_action` ON `audit_logs` (`action`);

