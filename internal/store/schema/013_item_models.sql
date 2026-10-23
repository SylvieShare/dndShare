CREATE TABLE dndshare.item_model (
    item_id bigint NOT NULL REFERENCES dndshare.item(id) ON DELETE CASCADE,
    model_id uuid NOT NULL REFERENCES dndshare.map_model(id) ON DELETE CASCADE,
    is_default boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    PRIMARY KEY (item_id, model_id)
);
CREATE UNIQUE INDEX item_model_default ON dndshare.item_model(item_id) WHERE is_default;
CREATE INDEX item_model_model ON dndshare.item_model(model_id);
