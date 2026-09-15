package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrConcentrationExpired = errors.New("концентрация уже завершена или изменена; обновите лист")

type ConcentrationEffect struct {
	UID      string            `json:"uid"`
	EffectID int64             `json:"effectId"`
	Name     string            `json:"name"`
	Target   ApplicationTarget `json:"target"`
}
type CharacterConcentration struct {
	ID        string                `json:"id"`
	SpellID   int64                 `json:"spellId"`
	Name      string                `json:"name"`
	StartedAt time.Time             `json:"startedAt"`
	Effects   []ConcentrationEffect `json:"effects"`
}

// A graph operation can touch multiple sheets and an encounter. Acquire this
// before any character/request/encounter locks, including application requests.
func lockConcentrationGraph(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980243,126)`)
	return err
}
func concentrationTx(ctx context.Context, tx pgx.Tx, charID int64) (*CharacterConcentration, error) {
	c := &CharacterConcentration{Effects: []ConcentrationEffect{}}
	err := tx.QueryRow(ctx, `SELECT cast_id::text,spell_id,spell_name,started_at FROM dndshare.character_concentration WHERE char_id=$1`, charID).Scan(&c.ID, &c.SpellID, &c.Name, &c.StartedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT e.effect_uid,e.effect_id,i.name,e.target
 FROM dndshare.concentration_effect e JOIN dndshare.item i ON i.id=e.effect_id
 LEFT JOIN dndshare."char" c ON c.id=e.target_char_id
 LEFT JOIN dndshare.session_encounter n ON n.id=e.encounter_id
 WHERE e.cast_id=$1::uuid AND (
 (c.deleted=false AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c.data#>'{values,states}','[]'::jsonb)) s WHERE s->>'uid'=e.effect_uid AND s#>>'{source,concentration_id}'=$1))
 OR (n.deleted=false AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(n.data->'combatants','[]'::jsonb)) npc CROSS JOIN LATERAL jsonb_array_elements(COALESCE(npc->'effectInstances','[]'::jsonb)) s WHERE npc->>'uid'=e.npc_uid AND s->>'uid'=e.effect_uid AND s#>>'{source,concentration_id}'=$1))) ORDER BY e.effect_uid`, c.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e ConcentrationEffect
		var raw json.RawMessage
		if err = rows.Scan(&e.UID, &e.EffectID, &e.Name, &raw); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &e.Target); err != nil {
			return nil, err
		}
		c.Effects = append(c.Effects, e)
	}
	return c, rows.Err()
}
func (s *Store) CharacterConcentration(ctx context.Context, charID int64) (*CharacterConcentration, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	c, err := concentrationTx(ctx, tx, charID)
	if err != nil {
		return nil, err
	}
	return c, tx.Commit(ctx)
}

func beginConcentrationTx(ctx context.Context, tx pgx.Tx, charID, spellID int64, name, castID string, reuse bool) (string, error) {
	var oldID string
	var oldSpell int64
	err := tx.QueryRow(ctx, `SELECT cast_id::text,spell_id FROM dndshare.character_concentration WHERE char_id=$1`, charID).Scan(&oldID, &oldSpell)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if oldID == castID || (reuse && oldSpell == spellID) {
		return oldID, nil
	}
	if oldID != "" {
		if err = endConcentrationTx(ctx, tx, charID, oldID); err != nil {
			return "", err
		}
	}
	// A first tracked spell also replaces manually held concentration on this sheet.
	var raw json.RawMessage
	if err = tx.QueryRow(ctx, `SELECT data FROM dndshare."char" WHERE id=$1 FOR UPDATE`, charID).Scan(&raw); err != nil {
		return "", err
	}
	doc, err := decodeTransferDocument(raw)
	if err != nil {
		return "", err
	}
	states, changed, err := removeConcentrationStates(ctx, tx, array(doc.values()["states"]), "", true)
	if err != nil {
		return "", err
	}
	if changed {
		doc.values()["states"] = states
		if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
			return "", err
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.character_concentration(char_id,cast_id,spell_id,spell_name) VALUES($1,$2::uuid,$3,$4)`, charID, castID, spellID, name)
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE dndshare."char" SET version=version+1,changed_at=now() WHERE id=$1`, charID)
	}
	return castID, err
}
func applicationNeedsConcentration(p ApplicationPlan) bool {
	if p.SourceKind != "spell" {
		return false
	}
	if p.Concentration {
		return true
	}
	for _, e := range p.Effects {
		if e.Concentration {
			return true
		}
	}
	return false
}
func linkConcentrationEffects(ctx context.Context, tx pgx.Tx, doc transferDocument, p ApplicationPlan, target ApplicationTarget) error {
	if p.ConcentrationID == "" {
		return nil
	}
	target.HP = nil // Concentration links expose identity, never a private HP snapshot.
	raw, _ := json.Marshal(target)
	for _, v := range array(doc.values()["states"]) {
		e := object(v)
		if textValue(object(e["source"])["concentration_id"]) != p.ConcentrationID {
			continue
		}
		_, err := tx.Exec(ctx, `INSERT INTO dndshare.concentration_effect(cast_id,effect_uid,effect_id,target_char_id,encounter_id,npc_uid,target)
 VALUES($1::uuid,$2,$3,NULLIF($4,0),NULLIF($5,0),NULLIF($6,''),CAST($7 AS jsonb)) ON CONFLICT DO NOTHING`, p.ConcentrationID, textValue(e["uid"]), number(e["effect_id"]), target.CharID, target.EncounterID, target.NPCUID, json.RawMessage(raw))
		if err != nil {
			return err
		}
	}
	return nil
}

// Include both old and new audiences around a mutation, even when a recipient
// has left the caster's session since the effect was applied.
func (s *Store) ConcentrationAudience(ctx context.Context, charID int64) (map[int64][]int64, error) {
	result := map[int64][]int64{}
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT p.session_id,p.char_id FROM dndshare.session_participant p WHERE p.char_id=$1 OR p.char_id IN (
 SELECT e.target_char_id FROM dndshare.concentration_effect e JOIN dndshare.character_concentration c USING(cast_id) WHERE c.char_id=$1)
 UNION SELECT n.session_id,0 FROM dndshare.session_encounter n JOIN dndshare.concentration_effect e ON e.encounter_id=n.id JOIN dndshare.character_concentration c USING(cast_id) WHERE c.char_id=$1`, charID)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var sessionID, id int64
		if err = rows.Scan(&sessionID, &id); err != nil {
			return result, err
		}
		result[sessionID] = append(result[sessionID], id)
	}
	return result, rows.Err()
}
