-- Images installed through MCP use content-addressed keys. System ownership
-- and the dedicated namespace make the upsert deterministic without changing
-- uniqueness rules for user-owned uploads or older deploy-managed catalogues.
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_image_system_item_media_key
    ON dndshare.storage_image USING btree ("key")
    WHERE user_id IS NULL AND "key" LIKE 'system-item-media/%';
