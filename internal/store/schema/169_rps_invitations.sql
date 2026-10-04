ALTER TABLE dndshare.session_interaction
    DROP CONSTRAINT session_interaction_status_check,
    DROP CONSTRAINT session_interaction_check1,
    DROP CONSTRAINT session_interaction_check2;

-- Unfinished old rounds become invitations; completed results stay intact.
UPDATE dndshare.session_interaction
SET sender_choice = NULL, recipient_choice = NULL
WHERE kind = 'rps_challenge' AND status <> 'completed';

UPDATE dndshare.session_event e
SET data = e.data - 'senderChoice' - 'recipientChoice' - 'winnerCharUuid'
FROM dndshare.session_interaction i
WHERE i.event_id = e.id AND i.kind = 'rps_challenge' AND i.status <> 'completed';

UPDATE dndshare.session_event e
SET data = e.data || '{"senderReady":true,"recipientReady":true}'::jsonb
FROM dndshare.session_interaction i
WHERE i.event_id = e.id AND i.kind = 'rps_challenge' AND i.status = 'completed';

ALTER TABLE dndshare.session_interaction
    ADD CONSTRAINT session_interaction_status_check
        CHECK (status IN ('pending', 'choosing', 'completed', 'declined', 'cancelled')),
    ADD CONSTRAINT session_interaction_round_check CHECK (
        (kind = 'chat_message' AND status = 'pending' AND sender_choice IS NULL AND recipient_choice IS NULL)
        OR (kind = 'rps_challenge' AND (
            (status IN ('pending', 'declined', 'cancelled') AND sender_choice IS NULL AND recipient_choice IS NULL)
            OR (status = 'choosing' AND (sender_choice IS NULL OR recipient_choice IS NULL))
            OR (status = 'completed' AND sender_choice IS NOT NULL AND recipient_choice IS NOT NULL)
        ))
    );

DROP INDEX dndshare.session_interaction_pending_round;
CREATE UNIQUE INDEX session_interaction_pending_round ON dndshare.session_interaction
    (session_id, LEAST(sender_char_id, recipient_char_id), GREATEST(sender_char_id, recipient_char_id))
    WHERE kind = 'rps_challenge' AND status IN ('pending', 'choosing');
