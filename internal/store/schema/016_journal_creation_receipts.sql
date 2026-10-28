CREATE TABLE dndshare.journal_creation_receipt (
    journal_id bigint NOT NULL REFERENCES dndshare.journal(id) ON DELETE CASCADE,
    client_action_id uuid NOT NULL,
    user_id bigint NOT NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    entity_kind text NOT NULL CHECK (entity_kind IN ('section', 'entry')),
    entity_id bigint NOT NULL,
    request_hash character(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (journal_id, client_action_id)
);
