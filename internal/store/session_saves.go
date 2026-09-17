package store

import (
	"context"
	"encoding/json"
	"fmt"
)

type SessionSaveResult struct {
	Target ApplicationTarget `json:"target"`
	Result json.RawMessage   `json:"result"`
}

func saveTargetKey(t ApplicationTarget) string {
	if t.Kind == "character" {
		return "char:" + t.CharUUID
	}
	if t.Kind == "npc" {
		return fmt.Sprintf("npc:%d:%s", t.EncounterID, t.NPCUID)
	}
	return ""
}

// A saving throw belongs to the original spell event. The DM rolls selected
// targets, just as in encounter challenges; retries cannot roll a target twice.
func (s *Store) AppendSessionSaves(ctx context.Context, userID, sessionID, eventID int64, results []SessionSaveResult) (SessionEvent, error) {
	if len(results) == 0 || len(results) > 50 {
		return SessionEvent{}, ErrApplication
	}
	targets, err := s.sessionChronicleTargets(ctx, userID, sessionID)
	if err != nil {
		return SessionEvent{}, err
	}
	byKey := map[string]ApplicationTarget{}
	for _, target := range targets {
		target.HP = nil
		byKey[saveTargetKey(target)] = target
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	var raw json.RawMessage
	err = tx.QueryRow(ctx, `SELECT e.data FROM dndshare.session_event e JOIN dndshare."session" s ON s.id=e.session_id WHERE e.id=$1 AND e.session_id=$2 AND s.owner_user_id=$3 AND NOT e.deleted AND NOT s.deleted FOR UPDATE OF e`, eventID, sessionID, userID).Scan(&raw)
	if err != nil {
		return SessionEvent{}, err
	}
	var data map[string]any
	if json.Unmarshal(raw, &data) != nil {
		return SessionEvent{}, ErrApplication
	}
	save := object(data["savingThrow"])
	ability, dc := number(save["ability"]), number(save["dc"])
	if ability < 1 || ability > 6 || dc < 1 || dc > 100 {
		return SessionEvent{}, ErrApplication
	}
	rows := array(save["results"])
	known := map[string]bool{}
	for _, row := range rows {
		known[textValue(object(row)["key"])] = true
	}
	for _, result := range results {
		key := saveTargetKey(result.Target)
		if known[key] {
			continue
		}
		target, ok := byKey[key]
		if !ok || len(result.Result) > 16000 {
			return SessionEvent{}, ErrApplication
		}
		var roll map[string]any
		if json.Unmarshal(result.Result, &roll) != nil || roll["total"] == nil || len(array(roll["parts"])) == 0 {
			return SessionEvent{}, ErrApplication
		}
		total, ok := roll["total"].(float64)
		if !ok || total < -1000 || total > 10000 {
			return SessionEvent{}, ErrApplication
		}
		rows = append(rows, map[string]any{"key": key, "target": target, "result": roll, "success": total >= float64(dc)})
		known[key] = true
	}
	if len(rows) > 200 {
		return SessionEvent{}, ErrApplication
	}
	save["results"] = rows
	data["savingThrow"] = save
	raw, err = json.Marshal(data)
	if err != nil {
		return SessionEvent{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=CAST($2 AS jsonb) WHERE id=$1`, eventID, raw); err != nil {
		return SessionEvent{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionEvent{}, err
	}
	return scanSessionEvent(s.pool.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
}
