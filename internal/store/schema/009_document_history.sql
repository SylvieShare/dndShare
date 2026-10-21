CREATE TABLE dndshare.character_change (
    id bigserial PRIMARY KEY,
    char_id bigint NOT NULL REFERENCES dndshare."char"(id) ON DELETE CASCADE,
    from_version bigint NOT NULL,
    to_version bigint NOT NULL,
    mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
    request_hash text NOT NULL DEFAULT '',
    author_user_id bigint,
    transaction_id bigint NOT NULL DEFAULT txid_current(),
    metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
    patches jsonb NOT NULL,
    inverse jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (char_id, mutation_id),
    CHECK (to_version > from_version)
);
CREATE INDEX character_change_version_idx ON dndshare.character_change(char_id, to_version);
CREATE INDEX character_change_history_idx ON dndshare.character_change(char_id, id DESC);
