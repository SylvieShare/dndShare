-- Chronicle events may reference the bestiary creature that acted. The event
-- keeps actor_name as the immutable label while the optional item link provides
-- the current handbook icon or cover artwork.
ALTER TABLE dndshare.session_event
    ADD COLUMN IF NOT EXISTS actor_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_event_actor_item
    ON dndshare.session_event USING btree (actor_item_id)
    WHERE actor_item_id IS NOT NULL;
