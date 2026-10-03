ALTER TABLE dndshare.suggest
    ADD COLUMN icon_image_id bigint REFERENCES dndshare.storage_image(id);

CREATE INDEX idx_suggest_icon_image_id ON dndshare.suggest(icon_image_id)
    WHERE icon_image_id IS NOT NULL;
