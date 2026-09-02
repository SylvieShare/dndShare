package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// SessionEvent is an append-only, user-facing event in a game session timeline.
type SessionEvent struct {
	ID                   int64           `json:"id"`
	SessionID            int64           `json:"-"`
	AuthorUserID         int64           `json:"authorUserId"`
	AuthorIsSessionOwner bool            `json:"authorIsSessionOwner"`
	ActorCharID          *int64          `json:"actorCharId,omitempty"`
	ActorCharUUID        *string         `json:"actorCharUuid,omitempty"`
	ActorTemplateID      *int64          `json:"actorTemplateId,omitempty"`
	ActorData            json.RawMessage `json:"actorData,omitempty"`
	ActorItemID          *int64          `json:"actorItemId,omitempty"`
	ActorImageURL        *string         `json:"actorImageUrl,omitempty"`
	ActorSVG             *string         `json:"actorSvg,omitempty"`
	ActorName            *string         `json:"actorName,omitempty"`
	EventType            string          `json:"type"`
	Action               string          `json:"action"`
	Data                 json.RawMessage `json:"data"`
	Visibility           string          `json:"visibility"`
	CreatedAt            time.Time       `json:"createdAt"`
}

// CharacterSessionEvent is written atomically with a character data update.
type CharacterSessionEvent struct {
	SessionUUID    string
	EventType      string
	Action         string
	Data           json.RawMessage
	Visibility     string
	ClientActionID string
}

const sessionEventSelect = `
	SELECT e.id, e.session_id, e.author_user_id,
	       event_session.owner_user_id = e.author_user_id,
	       e.actor_char_id, c.uuid::text, c.template_id, c.data,
	       e.actor_item_id,
	       COALESCE(character_icon.url, actor_icon.url, actor_cover.url), actor_svg.data,
	       e.actor_name, e.event_type, e.action, COALESCE(e.data, '{}'::jsonb), e.visibility, e.created_at
	FROM dndshare.session_event e
	JOIN dndshare."session" event_session ON event_session.id = e.session_id
	LEFT JOIN dndshare."char" c ON c.id = e.actor_char_id
	LEFT JOIN dndshare.storage_image character_icon ON character_icon.id = c.icon_image_id AND character_icon.deleted = false
	LEFT JOIN dndshare.item actor_item ON actor_item.id = e.actor_item_id
	LEFT JOIN dndshare.storage_image actor_icon ON actor_icon.id = actor_item.icon_image_id AND actor_icon.deleted = false
	LEFT JOIN dndshare.storage_image actor_cover ON actor_cover.id = actor_item.cover_image_id AND actor_cover.deleted = false
	LEFT JOIN dndshare.svg_storage actor_svg ON actor_svg.id = actor_item.icon_svg_id
	WHERE e.deleted = false`

func scanSessionEvent(row pgx.Row) (SessionEvent, error) {
	var event SessionEvent
	var actorData []byte
	var data []byte
	err := row.Scan(
		&event.ID, &event.SessionID, &event.AuthorUserID, &event.AuthorIsSessionOwner,
		&event.ActorCharID, &event.ActorCharUUID, &event.ActorTemplateID, &actorData,
		&event.ActorItemID, &event.ActorImageURL, &event.ActorSVG,
		&event.ActorName, &event.EventType, &event.Action, &data, &event.Visibility, &event.CreatedAt,
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
func (s *Store) ResolveSessionActor(ctx context.Context, sessionID, userID int64, charUUID *string) (*int64, *string, error) {
	var ownerUserID int64
	if err := s.pool.QueryRow(ctx, `SELECT owner_user_id FROM dndshare."session" WHERE id = $1`, sessionID).Scan(&ownerUserID); err != nil {
		return nil, nil, err
	}
	if charUUID == nil || *charUUID == "" {
		if ownerUserID != userID {
			return nil, nil, ErrNotFound
		}
		return nil, nil, nil
	}
	var charID int64
	var actorName string
	query := `
		SELECT c.id, left(COALESCE(
			NULLIF(btrim(c.data #>> '{values,name}'), ''),
			NULLIF(btrim(c.data #>> '{values,char_name}'), ''),
			'(без имени)'
		), 160)
		FROM dndshare."char" c
		JOIN dndshare.session_participant participant
		  ON participant.char_id = c.id AND participant.session_id = $1
		WHERE c.uuid = $2::uuid AND c.deleted = false`
	args := []any{sessionID, *charUUID}
	if ownerUserID != userID {
		query += ` AND c.user_id = $3 AND participant.user_id = $3`
		args = append(args, userID)
	}
	err := s.pool.QueryRow(ctx, query, args...).Scan(&charID, &actorName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	return &charID, &actorName, nil
}

// ResolveSessionActorItem resolves a bestiary creature used by a DM action.
// System creatures are available to every DM; custom creatures must belong to
// the current user. The returned name is only a fallback because actor_name is
// still stored as the immutable event label.
func (s *Store) ResolveSessionActorItem(ctx context.Context, userID int64, itemID *int64) (*int64, *string, error) {
	if itemID == nil {
		return nil, nil, nil
	}
	var id int64
	var name string
	err := s.pool.QueryRow(ctx, `
		SELECT id, name
		FROM dndshare.item
		WHERE id = $1 AND type_id = 6 AND (user_id IS NULL OR user_id = $2)`, *itemID, userID).Scan(&id, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	return &id, &name, nil
}

// CreateSessionEvent appends an event and returns its complete projection.
func (s *Store) CreateSessionEvent(ctx context.Context, sessionID, userID int64, actorCharID, actorItemID *int64, actorName *string, eventType, action string, data json.RawMessage, visibility string, clientActionID *string) (SessionEvent, error) {
	if len(data) == 0 {
		data = json.RawMessage("{}")
	}
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.session_event
		  (session_id, author_user_id, actor_char_id, actor_item_id, actor_name, event_type, action, data, visibility, client_action_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS jsonb), $9, $10::uuid)
		ON CONFLICT (session_id, client_action_id) WHERE client_action_id IS NOT NULL
		DO UPDATE SET client_action_id = EXCLUDED.client_action_id
		RETURNING id`, sessionID, userID, actorCharID, actorItemID, actorName, eventType, action, string(data), visibility, clientActionID).Scan(&id)
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
		actorName := characterName(data)

		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_event
			  (session_id, author_user_id, actor_char_id, actor_name, event_type, action, data, visibility, client_action_id)
			VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS jsonb), $8, $9::uuid)
			ON CONFLICT (session_id, client_action_id) WHERE client_action_id IS NOT NULL
			DO NOTHING`, sessionID, userID, actorCharID, actorName, event.EventType, event.Action,
			string(event.Data), event.Visibility, event.ClientActionID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func characterName(data json.RawMessage) string {
	var character struct {
		Values struct {
			Name     string `json:"name"`
			CharName string `json:"char_name"`
		} `json:"values"`
	}
	if json.Unmarshal(data, &character) == nil {
		if name := strings.TrimSpace(character.Values.Name); name != "" {
			return truncateRunes(name, 160)
		}
		if name := strings.TrimSpace(character.Values.CharName); name != "" {
			return truncateRunes(name, 160)
		}
	}
	return "(без имени)"
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
