package store

import (
	"context"
	"encoding/json"
)

// The target selection belongs to the attack event; it never rerolls dice or
// changes HP. Resolve identities on the server instead of publishing snapshots.
func (s *Store) SetSessionAttackTargets(ctx context.Context, userID, sessionID, eventID int64, requested []ApplicationTarget) (SessionEvent, error) {
	if len(requested) > 50 {
		return SessionEvent{}, ErrApplication
	}
	available, err := s.SessionApplicationTargets(ctx, userID, sessionID)
	if err != nil {
		return SessionEvent{}, err
	}
	targets, err := canonicalAttackTargets(requested, available)
	if err != nil {
		return SessionEvent{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	var raw json.RawMessage
	err = tx.QueryRow(ctx, `SELECT e.data FROM dndshare.session_event e JOIN dndshare."session" s ON s.id=e.session_id
 WHERE e.id=$1 AND e.session_id=$2 AND s.owner_user_id=$3 AND NOT e.deleted AND NOT s.deleted FOR UPDATE OF e`, eventID, sessionID, userID).Scan(&raw)
	if err != nil {
		return SessionEvent{}, err
	}
	var data map[string]any
	if json.Unmarshal(raw, &data) != nil || !isSessionAttack(data) {
		return SessionEvent{}, ErrApplication
	}
	data["attackTargets"] = targets
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

func isSessionAttack(data map[string]any) bool {
	if data["attackRoll"] != true || data["damageRoll"] == true {
		return false
	}
	for _, part := range array(object(data["result"])["parts"]) {
		p := object(part)
		if p["kind"] == "dice" && number(p["sides"]) == 20 {
			return true
		}
	}
	return false
}

func canonicalAttackTargets(requested, available []ApplicationTarget) ([]ApplicationTarget, error) {
	byKey := map[string]ApplicationTarget{}
	for _, target := range available {
		target.HP, target.Snapshot = nil, nil
		byKey[saveTargetKey(target)] = target
	}
	result := []ApplicationTarget{}
	seen := map[string]bool{}
	for _, target := range requested {
		key := saveTargetKey(target)
		canonical, ok := byKey[key]
		if !ok || key == "" {
			return nil, ErrApplication
		}
		if !seen[key] {
			result = append(result, canonical)
			seen[key] = true
		}
	}
	return result, nil
}
