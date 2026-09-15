package store

import (
	"context"
	"encoding/json"
)

type ApplicationTarget struct {
	Kind        string `json:"kind,omitempty"`
	CharUUID    string `json:"charUuid,omitempty"`
	CharID      int64  `json:"charId,omitempty"`
	NPCUID      string `json:"npcUid,omitempty"`
	EncounterID int64  `json:"encounterId,omitempty"`
	Name        string `json:"name,omitempty"`
	ImageURL    string `json:"imageUrl,omitempty"`
	Letter      string `json:"letter,omitempty"`
	Color       string `json:"color,omitempty"`
}

func applicationRecipientName(id int64, data json.RawMessage) string {
	if id == 0 {
		return "Мастер"
	}
	return characterName(data)
}

func ownsApplicationSpell(v any, id int) bool {
	if id <= 0 {
		return false
	}
	switch value := v.(type) {
	case map[string]any:
		if number(value["id"]) == id {
			return true
		}
		for _, child := range value {
			if ownsApplicationSpell(child, id) {
				return true
			}
		}
	case []any:
		for _, child := range value {
			if ownsApplicationSpell(child, id) {
				return true
			}
		}
	}
	return false
}

func (s *Store) CreateSpellApplication(ctx context.Context, userID, sessionID, senderID, recipientID, version int64, uid, actionID, option string) (ItemTransfer, error) {
	return s.createItemTransfer(ctx, userID, sessionID, senderID, recipientID, version, "spells", uid, actionID, "use", option)
}

func (s *Store) ResolveSessionApplication(ctx context.Context, userID, sessionID, eventID int64, accept bool, target ApplicationTarget) (ItemTransfer, error) {
	return s.resolveItemTransfer(ctx, userID, 0, eventID, sessionID, accept, target)
}

func (s *Store) SessionApplicationTargets(ctx context.Context, userID, sessionID int64) ([]ApplicationTarget, error) {
	var allowed bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare."session" WHERE id=$1 AND owner_user_id=$2 AND deleted=false)`, sessionID, userID).Scan(&allowed); err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrNotFound
	}
	targets := []ApplicationTarget{}
	rows, err := s.pool.Query(ctx, `SELECT c.uuid::text,c.data,COALESCE(icon.url,c.data #>> '{values,ava,url}','')
 FROM dndshare.session_participant p JOIN dndshare."char" c ON c.id=p.char_id
 LEFT JOIN dndshare.storage_image icon ON icon.id=c.icon_image_id AND icon.deleted=false
 WHERE p.session_id=$1 AND c.deleted=false ORDER BY c.id`, sessionID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var uuid, imageURL string
		var raw json.RawMessage
		if err = rows.Scan(&uuid, &raw, &imageURL); err != nil {
			rows.Close()
			return nil, err
		}
		targets = append(targets, ApplicationTarget{Kind: "character", CharUUID: uuid, Name: characterName(raw), ImageURL: imageURL})
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = s.pool.Query(ctx, `SELECT e.id,c.value,COALESCE(i.name,'Существо') FROM (SELECT id,data FROM dndshare.session_encounter WHERE session_id=$1 AND deleted=false ORDER BY id DESC LIMIT 1) e CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.data->'combatants','[]'::jsonb)) c(value) LEFT JOIN dndshare.item i ON i.id=CASE WHEN c.value->>'itemId' ~ '^[0-9]+$' THEN (c.value->>'itemId')::bigint END WHERE c.value->>'type'='npc'`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var raw json.RawMessage
		var name string
		if err = rows.Scan(&id, &raw, &name); err != nil {
			return nil, err
		}
		var c map[string]any
		_ = json.Unmarshal(raw, &c)
		targets = append(targets, npcApplicationTarget(id, c, name))
	}
	return targets, rows.Err()
}
