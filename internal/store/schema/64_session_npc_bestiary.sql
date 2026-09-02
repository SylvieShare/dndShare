-- Prepared session NPCs may point at a handbook bestiary creature. The link is
-- optional and deliberately stores no creature snapshot: canvas previews open
-- the current handbook record.
ALTER TABLE dndshare.session_npc
    ADD COLUMN IF NOT EXISTS bestiary_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_npc_bestiary_item
    ON dndshare.session_npc USING btree (bestiary_item_id)
    WHERE bestiary_item_id IS NOT NULL;
