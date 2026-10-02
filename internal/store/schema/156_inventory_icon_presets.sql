CREATE TABLE dndshare.item_icon_preset (
    id bigserial PRIMARY KEY,
    item_type_id bigint NOT NULL REFERENCES dndshare.item_type(id),
    code varchar(64) NOT NULL,
    name varchar(128) NOT NULL,
    purpose varchar(16) NOT NULL DEFAULT 'item' CHECK (purpose IN ('item', 'empty_cell')),
    sort_order integer NOT NULL DEFAULT 0,
    image_id bigint NOT NULL REFERENCES dndshare.storage_image(id),
    UNIQUE (item_type_id, code)
);
CREATE INDEX idx_item_icon_preset_image ON dndshare.item_icon_preset(image_id);
CREATE UNIQUE INDEX idx_item_icon_preset_empty ON dndshare.item_icon_preset(item_type_id) WHERE purpose = 'empty_cell';
