UPDATE dndshare."session"
SET settings = settings || '{"karmicDice":{"enabled":false,"separate":false}}'::jsonb;

ALTER TABLE dndshare."session" ALTER COLUMN settings SET DEFAULT
'{"players":{"seeClass":true,"seeRace":true,"seeHp":false,"openSheets":true},"combat":{"autoRollNpcHp":false},"interactions":{"items":true,"potions":true,"spells":true},"autoAccept":{"items":false,"potions":false,"spells":false},"karmicDice":{"enabled":false,"separate":false}}'::jsonb;

CREATE TABLE dndshare.session_karmic_scale (
    session_id bigint NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    actor_key text NOT NULL,
    actor_name text NOT NULL,
    balance smallint NOT NULL CHECK (balance BETWEEN -6 AND 6),
    PRIMARY KEY (session_id, actor_key)
);

CREATE TABLE dndshare.session_d20_roll (
    session_id bigint NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    user_id bigint NOT NULL,
    request jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, request_id)
);
