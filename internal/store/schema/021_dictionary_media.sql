-- Dictionary art uses the existing storage_image contract; no content is seeded.
ALTER TABLE dndshare.suggest ADD COLUMN cover_image_id bigint REFERENCES dndshare.storage_image(id);
ALTER TABLE dndshare.suggest_type ADD COLUMN icon_image_id bigint REFERENCES dndshare.storage_image(id);
ALTER TABLE dndshare.suggest_type ADD COLUMN cover_image_id bigint REFERENCES dndshare.storage_image(id);
CREATE INDEX idx_suggest_cover_image_id ON dndshare.suggest(cover_image_id) WHERE cover_image_id IS NOT NULL;
CREATE INDEX idx_suggest_type_icon_image_id ON dndshare.suggest_type(icon_image_id) WHERE icon_image_id IS NOT NULL;
CREATE INDEX idx_suggest_type_cover_image_id ON dndshare.suggest_type(cover_image_id) WHERE cover_image_id IS NOT NULL;
