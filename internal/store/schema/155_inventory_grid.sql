ALTER TABLE dndshare.session_inventory ADD COLUMN slot integer;
WITH numbered AS (
    SELECT id, row_number() OVER (PARTITION BY session_id,available ORDER BY created_at,id) - 1 AS slot
    FROM dndshare.session_inventory
)
UPDATE dndshare.session_inventory i SET slot=n.slot FROM numbered n WHERE i.id=n.id;
ALTER TABLE dndshare.session_inventory ALTER COLUMN slot SET NOT NULL;
ALTER TABLE dndshare.session_inventory ADD CONSTRAINT session_inventory_slot_nonnegative CHECK(slot >= 0);
CREATE UNIQUE INDEX session_inventory_slot ON dndshare.session_inventory(session_id,slot) WHERE available;
