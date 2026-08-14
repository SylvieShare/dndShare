package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// SessionEvent is an append-only, user-facing event in a game session timeline.
type SessionEvent struct {
	ID              int64           `json:"id"`
	SessionID       int64           `json:"-"`
	AuthorUserID    int64           `json:"authorUserId"`
	AuthorRole      string          `json:"authorRole"`
	ActorCharID     *int64          `json:"actorCharId,omitempty"`
	ActorCharUUID   *string         `json:"actorCharUuid,omitempty"`
	ActorTemplateID *int64          `json:"actorTemplateId,omitempty"`
	ActorData       json.RawMessage `json:"actorData,omitempty"`
	EventType       string          `json:"type"`
	Title           *string         `json:"title,omitempty"`
	Data            json.RawMessage `json:"data"`
	Visibility      string          `json:"visibility"`
	CreatedAt       time.Time       `json:"createdAt"`
}

// CharacterSessionEvent is written atomically with a character data update.
type CharacterSessionEvent struct {
	SessionUUID    string
	EventType      string
	Title          string
	Data           json.RawMessage
	Visibility     string
	ClientActionID string
}

const sessionEventSelect = `
	SELECT e.id, e.session_id, e.author_user_id,
	       CASE WHEN event_session.owner_user_id = e.author_user_id THEN 'gm' ELSE 'player' END,
	       e.actor_char_id, c.uuid::text, c.template_id, c.data,
	       e.event_type, e.title, COALESCE(e.data, '{}'::jsonb), e.visibility, e.created_at
	FROM dndshare.session_event e
	JOIN dndshare."session" event_session ON event_session.id = e.session_id
	LEFT JOIN dndshare."char" c ON c.id = e.actor_char_id
	WHERE e.deleted = false`

func scanSessionEvent(row pgx.Row) (SessionEvent, error) {
	var event SessionEvent
	var actorData []byte
	var data []byte
	err := row.Scan(
		&event.ID, &event.SessionID, &event.AuthorUserID, &event.AuthorRole,
		&event.ActorCharID, &event.ActorCharUUID, &event.ActorTemplateID, &actorData,
		&event.EventType, &event.Title, &data, &event.Visibility, &event.CreatedAt,
	)
	if len(actorData) > 0 {
		event.ActorData = json.RawMessage(actorData)
	}
	event.Data = json.RawMessage(data)
	return event, err
}

// UserCanAccessSession reports whether a user is the DM or owns a participant in the session.
func (s *Store) UserCanAccessSession(ctx context.Context, sessionID, userID int64) (bool, error) {
	var allowed bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dndshare."session" session
			WHERE session.id = $1 AND session.deleted = false
			  AND (session.owner_user_id = $2 OR EXISTS (
				SELECT 1 FROM dndshare.session_participant participant
				WHERE participant.session_id = session.id AND participant.user_id = $2
			  ))
		)`, sessionID, userID).Scan(&allowed)
	return allowed, err
}

// ResolveSessionActor resolves the character whose page produced an event.
// Players may use only their own participant; the DM may use any participant in the session.
func (s *Store) ResolveSessionActor(ctx context.Context, sessionID, userID int64, charUUID *string) (*int64, error) {
	var ownerUserID int64
	if err := s.pool.QueryRow(ctx, `SELECT owner_user_id FROM dndshare."session" WHERE id = $1`, sessionID).Scan(&ownerUserID); err != nil {
		return nil, err
	}
	if charUUID == nil || *charUUID == "" {
		if ownerUserID != userID {
			return nil, ErrNotFound
		}
		return nil, nil
	}
	var charID int64
	query := `
		SELECT c.id
		FROM dndshare."char" c
		JOIN dndshare.session_participant participant
		  ON participant.char_id = c.id AND participant.session_id = $1
		WHERE c.uuid = $2::uuid AND c.deleted = false`
	args := []any{sessionID, *charUUID}
	if ownerUserID != userID {
		query += ` AND c.user_id = $3 AND participant.user_id = $3`
		args = append(args, userID)
	}
	err := s.pool.QueryRow(ctx, query, args...).Scan(&charID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &charID, nil
}

// CreateSessionEvent appends an event and returns its complete projection.
func (s *Store) CreateSessionEvent(ctx context.Context, sessionID, userID int64, actorCharID *int64, eventType string, title *string, data json.RawMessage, visibility string, clientActionID *string) (SessionEvent, error) {
	if len(data) == 0 {
		data = json.RawMessage("{}")
	}
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.session_event
		  (session_id, author_user_id, actor_char_id, event_type, title, data, visibility, client_action_id)
		VALUES ($1, $2, $3, $4, $5, CAST($6 AS jsonb), $7, $8::uuid)
		ON CONFLICT (session_id, client_action_id) WHERE client_action_id IS NOT NULL
		DO UPDATE SET client_action_id = EXCLUDED.client_action_id
		RETURNING id`, sessionID, userID, actorCharID, eventType, title, string(data), visibility, clientActionID).Scan(&id)
	if err != nil {
		return SessionEvent{}, err
	}
	return scanSessionEvent(s.pool.QueryRow(ctx, sessionEventSelect+` AND e.id = $1`, id))
}

// GetSessionEvents returns the newest page for afterID=0, otherwise events after the cursor.
func (s *Store) GetSessionEvents(ctx context.Context, sessionID, userID, afterID int64, limit int) ([]SessionEvent, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	visibility := ` AND (e.visibility = 'public' OR e.author_user_id = $2 OR EXISTS (
		SELECT 1 FROM dndshare."session" owner_session
		WHERE owner_session.id = e.session_id AND owner_session.owner_user_id = $2
	))`
	query := sessionEventSelect + ` AND e.session_id = $1` + visibility
	args := []any{sessionID, userID}
	if afterID > 0 {
		query += ` AND e.id > $3 ORDER BY e.id ASC LIMIT $4`
		args = append(args, afterID, limit)
	} else {
		query += ` ORDER BY e.id DESC LIMIT $3`
		args = append(args, limit)
	}
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := []SessionEvent{}
	for rows.Next() {
		event, err := scanSessionEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if afterID == 0 {
		for left, right := 0, len(events)-1; left < right; left, right = left+1, right-1 {
			events[left], events[right] = events[right], events[left]
		}
	}
	return events, nil
}

// UpdateCharacterDataWithEvents makes character state and its semantic session history one commit.
func (s *Store) UpdateCharacterDataWithEvents(ctx context.Context, userID int64, character CharacterItem, data json.RawMessage, events []CharacterSessionEvent) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE dndshare."char"
		SET data = CAST($2 AS jsonb), changed_at = now(), version = version + 1
		WHERE id = $1 AND deleted = false AND data IS DISTINCT FROM CAST($2 AS jsonb)`, character.ID, string(data)); err != nil {
		return err
	}

	for _, event := range events {
		var sessionID, ownerUserID int64
		err := tx.QueryRow(ctx, `
			SELECT id, owner_user_id
			FROM dndshare."session"
			WHERE uuid = $1::uuid AND deleted = false`, event.SessionUUID).Scan(&sessionID, &ownerUserID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}

		var participantUserID int64
		err = tx.QueryRow(ctx, `
			SELECT participant.user_id
			FROM dndshare.session_participant participant
			WHERE participant.session_id = $1 AND participant.char_id = $2`,
			sessionID, character.ID).Scan(&participantUserID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if ownerUserID != userID && (participantUserID != userID || character.UserID != userID || event.Visibility == "gm") {
			return ErrNotFound
		}
		actorCharID := character.ID

		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_event
			  (session_id, author_user_id, actor_char_id, event_type, title, data, visibility, client_action_id)
			VALUES ($1, $2, $3, $4, $5, CAST($6 AS jsonb), $7, $8::uuid)
			ON CONFLICT (session_id, client_action_id) WHERE client_action_id IS NOT NULL
			DO NOTHING`, sessionID, userID, actorCharID, event.EventType, event.Title,
			string(event.Data), event.Visibility, event.ClientActionID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
