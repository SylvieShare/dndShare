CREATE TABLE dndshare.session_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id bigint NOT NULL REFERENCES dndshare."session"(id),
    source text NOT NULL CHECK(source IN ('items','weapon','potions')),
    entry jsonb NOT NULL,
    item_name text NOT NULL,
    available bool NOT NULL DEFAULT true,
    client_action_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(session_id, client_action_id)
);
CREATE INDEX session_inventory_available ON dndshare.session_inventory(session_id) WHERE available;
ALTER TABLE dndshare.item_transfer ALTER COLUMN sender_char_id DROP NOT NULL;
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_dm_use;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_inventory_sender CHECK(sender_char_id IS NOT NULL OR (purpose='transfer' AND recipient_char_id IS NOT NULL));
CREATE UNIQUE INDEX item_transfer_inventory_action ON dndshare.item_transfer(session_id, client_action_id) WHERE sender_char_id IS NULL;
