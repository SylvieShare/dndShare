CREATE TABLE dndshare.session_interaction (
    event_id bigint PRIMARY KEY REFERENCES dndshare.session_event(id),
    session_id bigint NOT NULL REFERENCES dndshare."session"(id),
    sender_char_id bigint NOT NULL REFERENCES dndshare."char"(id),
    recipient_char_id bigint NOT NULL REFERENCES dndshare."char"(id),
    kind text NOT NULL CHECK (kind IN ('chat_message', 'rps_challenge')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'cancelled')),
    sender_choice text CHECK (sender_choice IN ('rock', 'scissors', 'paper')),
    recipient_choice text CHECK (recipient_choice IN ('rock', 'scissors', 'paper')),
    read_at timestamptz,
    CHECK (sender_char_id <> recipient_char_id),
    CHECK ((kind = 'chat_message' AND sender_choice IS NULL AND recipient_choice IS NULL)
        OR (kind = 'rps_challenge' AND sender_choice IS NOT NULL)),
    CHECK (kind <> 'rps_challenge' OR (status = 'completed') = (recipient_choice IS NOT NULL))
);
CREATE INDEX session_interaction_sender ON dndshare.session_interaction(session_id, sender_char_id, event_id DESC);
CREATE INDEX session_interaction_recipient ON dndshare.session_interaction(session_id, recipient_char_id, event_id DESC);
-- One outstanding round per pair, including challenges in the reverse direction.
CREATE UNIQUE INDEX session_interaction_pending_round ON dndshare.session_interaction
    (session_id, LEAST(sender_char_id, recipient_char_id), GREATEST(sender_char_id, recipient_char_id))
    WHERE kind = 'rps_challenge' AND status = 'pending';
