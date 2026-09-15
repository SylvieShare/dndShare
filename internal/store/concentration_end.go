package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func removeConcentrationStates(ctx context.Context, tx pgx.Tx, states []any, castID string, manual bool, trigger ...string) ([]any, bool, error) {
	kept := []any{}
	removed := []map[string]any{}
	for _, raw := range states {
		e := object(raw)
		matches := textValue(object(e["source"])["concentration_id"]) == castID && castID != ""
		if manual {
			matches = e["concentration"] == true
		}
		if len(trigger) > 0 {
			_, data, _, err := applicationItem(ctx, tx, int64(number(e["effect_id"])))
			if err != nil && err != pgx.ErrNoRows {
				return nil, false, err
			}
			for _, event := range array(data["end_on"]) {
				if event == trigger[0] {
					matches = true
				}
			}
		}
		if matches {
			removed = append(removed, e)
		} else {
			kept = append(kept, raw)
		}
	}
	// Restore a retained local concentration when its replacement effect ends.
	for _, raw := range kept {
		state := object(raw)
		if state["external_only"] != true {
			continue
		}
		active := false
		for _, otherRaw := range kept {
			other := object(otherRaw)
			if other["external_only"] != true && number(other["effect_id"]) == number(state["effect_id"]) {
				active = true
				break
			}
		}
		if !active {
			delete(state, "external_only")
		}
	}
	for _, old := range removed {
		_, data, _, err := applicationItem(ctx, tx, int64(number(old["effect_id"])))
		if err == pgx.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, false, err
		}
		nextID := int64(number(object(data["on_end_effect"])["id"]))
		if nextID == 0 {
			continue
		}
		name, next, kind, err := applicationItem(ctx, tx, nextID)
		if err != nil {
			return nil, false, err
		}
		if kind != 15 {
			continue
		}
		doc := transferDocument{"values": map[string]any{"states": kept}}
		p := ApplicationPlan{Effects: []ApplicationEffect{{ID: nextID, Name: name, Data: next, Duration: object(next["duration"])}}, ItemID: int64(number(old["effect_id"])), Name: name}
		if _, err = applyApplication(doc, p, "concentration-end-"+textValue(old["uid"]), secureApplicationDie); err != nil {
			return nil, false, err
		}
		kept = array(doc.values()["states"])
	}
	return kept, len(removed) > 0, nil
}

func endConcentrationTx(ctx context.Context, tx pgx.Tx, charID int64, castID string) error {
	var actual string
	err := tx.QueryRow(ctx, `SELECT cast_id::text FROM dndshare.character_concentration WHERE char_id=$1`, charID).Scan(&actual)
	if err == pgx.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	if actual != castID {
		return ErrConcentrationExpired
	}
	rows, err := tx.Query(ctx, `SELECT c.id,c.data FROM dndshare."char" c WHERE c.id=$2 OR c.id IN (SELECT target_char_id FROM dndshare.concentration_effect WHERE cast_id=$1::uuid) ORDER BY c.id FOR UPDATE`, castID, charID)
	if err != nil {
		return err
	}
	type targetDoc struct {
		id  int64
		raw json.RawMessage
	}
	targets := []targetDoc{}
	for rows.Next() {
		var t targetDoc
		if err = rows.Scan(&t.id, &t.raw); err != nil {
			rows.Close()
			return err
		}
		targets = append(targets, t)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, t := range targets {
		doc, e := decodeTransferDocument(t.raw)
		if e != nil {
			return e
		}
		states, changed, e := removeConcentrationStates(ctx, tx, array(doc.values()["states"]), castID, false)
		if e != nil {
			return e
		}
		if changed {
			doc.values()["states"] = states
			if e = saveTransferDocument(ctx, tx, t.id, doc); e != nil {
				return e
			}
		}
	}
	rows, err = tx.Query(ctx, `SELECT id,data FROM dndshare.session_encounter WHERE id IN (SELECT encounter_id FROM dndshare.concentration_effect WHERE cast_id=$1::uuid) ORDER BY id FOR UPDATE`, castID)
	if err != nil {
		return err
	}
	targets = nil
	for rows.Next() {
		var t targetDoc
		if err = rows.Scan(&t.id, &t.raw); err != nil {
			rows.Close()
			return err
		}
		targets = append(targets, t)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, t := range targets {
		var data map[string]any
		if err = json.Unmarshal(t.raw, &data); err != nil {
			return err
		}
		changed := false
		for _, raw := range array(data["combatants"]) {
			npc := object(raw)
			states, did, e := removeConcentrationStates(ctx, tx, array(npc["effectInstances"]), castID, false)
			if e != nil {
				return e
			}
			if did {
				npc["effectInstances"] = states
				changed = true
			}
		}
		if changed {
			data["applicationRevision"] = number(data["applicationRevision"]) + 1
			raw, _ := json.Marshal(data)
			if _, err = tx.Exec(ctx, `UPDATE dndshare.session_encounter SET data=CAST($2 AS jsonb),changed_at=now() WHERE id=$1`, t.id, json.RawMessage(raw)); err != nil {
				return err
			}
		}
	}
	// Pending spell offers cannot outlive the cast which created them.
	if _, err = tx.Exec(ctx, `WITH ended AS (UPDATE dndshare.item_transfer SET status='rejected',resolved_at=now() WHERE status='pending' AND source='spells' AND application->>'concentrationId'=$1 RETURNING event_id)
 UPDATE dndshare.session_event SET data=data||'{"status":"rejected"}'::jsonb WHERE id IN (SELECT event_id FROM ended)`, castID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `DELETE FROM dndshare.character_concentration WHERE char_id=$1 AND cast_id=$2::uuid`, charID, castID)
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE dndshare."char" SET version=version+1,changed_at=now() WHERE id=$1`, charID)
	}
	return err
}

func (s *Store) ChangeConcentration(ctx context.Context, userID, charID, version, spellID int64, actionID, endID string) (*CharacterConcentration, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = lockConcentrationGraph(ctx, tx); err != nil {
		return nil, err
	}
	chars, err := lockTransferCharacters(ctx, tx, charID, charID)
	if err != nil {
		return nil, err
	}
	c := chars[charID]
	if c.UserID != userID {
		return nil, ErrNotFound
	}
	current, err := concentrationTx(ctx, tx, charID)
	if err != nil {
		return nil, err
	}
	if endID != "" && current == nil {
		return nil, tx.Commit(ctx)
	}
	if current != nil && current.ID == actionID {
		return current, tx.Commit(ctx)
	}
	if c.Version != version {
		return nil, ErrCharacterVersion
	}
	if endID != "" {
		if err = endConcentrationTx(ctx, tx, charID, endID); err != nil {
			return nil, err
		}
	} else {
		doc, e := decodeTransferDocument(c.Data)
		if e != nil {
			return nil, e
		}
		if allowed, err := canUseApplicationSpell(ctx, tx, doc.values(), int(spellID)); err != nil {
			return nil, err
		} else if !allowed {
			return nil, ErrNotFound
		}
		name, data, kind, e := visibleApplicationItem(ctx, tx, spellID, userID)
		if e != nil {
			return nil, e
		}
		if kind != 5 || data["concentration"] != true {
			return nil, fmt.Errorf("%w: заклинание не требует концентрации", ErrApplication)
		}
		if _, err = beginConcentrationTx(ctx, tx, charID, spellID, name, actionID, false); err != nil {
			return nil, err
		}
	}
	result, err := concentrationTx(ctx, tx, charID)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}
