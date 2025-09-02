-- Migration: Add gitlabToken column to users table
-- Date: 2025-01-15
-- Description: Adds gitlabToken field to store GitLab OAuth tokens

ALTER TABLE users ADD COLUMN IF NOT EXISTS "gitlabToken" VARCHAR(255);

-- Add comment to document the column
COMMENT ON COLUMN users."gitlabToken" IS 'GitLab OAuth access token for repository access'; 