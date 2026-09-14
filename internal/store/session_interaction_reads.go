package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

// A peer opens paginated history; no peer returns all unread messages and pending rounds.
// Access is checked against the current membership even after a character transfer.
func (s *Store) CharacterInteractions(ctx context.Context, userID, charID int64, sessionUUID, peerUUID string, beforeID int64) ([]SessionEvent, error) {
	query := sessionEventSelect + ` AND interaction.event_id IS NOT NULL
 AND event_session.uuid=$3::uuid AND event_session.deleted=false
 AND EXISTS (SELECT 1 FROM dndshare.session_participant p JOIN dndshare."char" own ON own.id=p.char_id
 WHERE p.session_id=e.session_id AND p.char_id=$1 AND p.user_id=$2 AND own.user_id=$2 AND own.deleted=false)
 AND (interaction.sender_char_id=$1 OR interaction.recipient_char_id=$1)`
	args := []any{charID, userID, sessionUUID}
	if peerUUID == "" {
		query += ` AND ((interaction.kind='chat_message' AND interaction.recipient_char_id=$1 AND interaction.read_at IS NULL)
   OR (interaction.kind='rps_challenge' AND interaction.status='pending')) ORDER BY e.id DESC`
	} else {
		query += ` AND ((c.uuid=$4::uuid AND interaction.recipient_char_id=$1)
   OR (interaction_recipient.uuid=$4::uuid AND interaction.sender_char_id=$1))
   AND ($5::bigint=0 OR e.id<$5) ORDER BY e.id DESC LIMIT 51`
		args = append(args, peerUUID, beforeID)
	}
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectInteractionEvents(rows)
}

func collectInteractionEvents(rows pgx.Rows) ([]SessionEvent, error) {
	result := []SessionEvent{}
	for rows.Next() {
		event, err := scanSessionEvent(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

// Mark only the messages actually displayed by the client, never concurrent arrivals.
func (s *Store) ReadCharacterMessages(ctx context.Context, userID, charID, throughID int64, sessionUUID, peerUUID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dndshare.session_interaction i SET read_at=now()
 FROM dndshare."session" session, dndshare."char" sender, dndshare."char" recipient
 WHERE i.session_id=session.id AND session.uuid=$1::uuid AND session.deleted=false
 AND sender.id=i.sender_char_id AND sender.uuid=$2::uuid
 AND recipient.id=i.recipient_char_id AND recipient.id=$3 AND recipient.user_id=$4 AND recipient.deleted=false
 AND i.kind='chat_message' AND i.read_at IS NULL AND i.event_id<=$5
 AND EXISTS(SELECT 1 FROM dndshare.session_participant p WHERE p.session_id=i.session_id AND p.char_id=$3 AND p.user_id=$4)`, sessionUUID, peerUUID, charID, userID, throughID)
	return err
}
