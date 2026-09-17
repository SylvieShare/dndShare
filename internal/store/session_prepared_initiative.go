package store

import (
	"context"
	"encoding/json"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
)

type initiativeQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

// The cursor acknowledges sheet rolls once. Master rolls have no sheetInitiative
// marker. Eligibility is checked before a pending roster move, never after it.
func projectSheetInitiatives(ctx context.Context, q initiativeQuerier, sessionID int64, doc, eligibility map[string]any) error {
	rows, err := q.Query(ctx, `SELECT e.id,e.actor_char_id,c.uuid::text,e.data
 FROM dndshare.session_event e
 JOIN dndshare.session_participant p ON p.session_id=e.session_id AND p.char_id=e.actor_char_id
 JOIN dndshare."char" c ON c.id=p.char_id AND c.deleted=false
 WHERE e.session_id=$1 AND e.id>$2 AND e.deleted=false AND e.event_type='dice_roll'
 AND e.data->'sheetInitiative'='true'::jsonb ORDER BY e.id`, sessionID, number(doc["sheetInitiativeCursor"]))
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, charID int64
		var uuid string
		var raw json.RawMessage
		if err := rows.Scan(&id, &charID, &uuid, &raw); err != nil {
			return err
		}
		var data map[string]any
		if err := json.Unmarshal(raw, &data); err != nil {
			return err
		}
		applySheetInitiative(doc, eligibility, id, charID, uuid, object(data["result"])["total"])
	}
	return rows.Err()
}

func applySheetInitiative(doc, eligibility map[string]any, id, charID int64, uuid string, total any) {
	doc["sheetInitiativeCursor"] = int(id)
	value, ok := total.(float64)
	if !ok || math.IsNaN(value) || math.IsInf(value, 0) || math.Trunc(value) != value {
		return
	}
	for _, raw := range array(eligibility["combatants"]) {
		c := object(raw)
		if c["type"] == "player" && number(c["charId"]) == int(charID) && c["position"] != "reserve" {
			return
		}
	}
	for _, raw := range array(doc["combatants"]) {
		c := object(raw)
		if c["type"] == "player" && number(c["charId"]) == int(charID) {
			if c["position"] != "dead" {
				c["initiative"] = value
			}
			return
		}
	}
	doc["combatants"] = append(array(doc["combatants"]), map[string]any{"uid": fmt.Sprintf("p-%d", charID), "type": "player", "charId": int(charID), "charUuid": uuid, "position": "reserve", "initiative": value, "surprised": false, "tieBreak": 0})
}
