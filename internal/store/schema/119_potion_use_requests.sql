ALTER TABLE dndshare.item_transfer
    ADD COLUMN purpose text NOT NULL DEFAULT 'transfer'
    CHECK (purpose IN ('transfer', 'use'));
ALTER TABLE dndshare.item_transfer
    ADD CONSTRAINT item_transfer_use_source CHECK (purpose <> 'use' OR source = 'potions');
