package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"time"
)

type SessionImpactTarget struct {
	Target  ApplicationTarget `json:"target"`
	Outcome string            `json:"outcome,omitempty"`
}
type SessionImpactRequest struct {
	EventID        int64                 `json:"eventId"`
	ClientActionID string                `json:"clientActionId"`
	Amount         int                   `json:"amount"`
	EffectKey      string                `json:"effectKey"`
	Targets        []SessionImpactTarget `json:"targets"`
}
type SessionImpactResponse struct {
	Event        SessionEvent `json:"event"`
	CharacterIDs []int64      `json:"characterIds"`
}

func (s *Store) SessionImpactActor(ctx context.Context, sessionID, eventID int64) int64 {
	var id int64
	_ = s.pool.QueryRow(ctx, `SELECT COALESCE(actor_char_id,0) FROM dndshare.session_event WHERE id=$1 AND session_id=$2 AND NOT deleted`, eventID, sessionID).Scan(&id)
	return id
}
func (s *Store) ApplySessionImpact(ctx context.Context, userID, sessionID int64, req SessionImpactRequest) (SessionImpactResponse, error) {
	out := SessionImpactResponse{CharacterIDs: []int64{}}
	if len(req.Targets) < 1 || len(req.Targets) > 50 || req.EventID < 0 || len(req.EffectKey) > 200 {
		return out, ErrApplication
	}
	targets, err := s.sessionChronicleTargets(ctx, userID, sessionID)
	if err != nil {
		return out, err
	}
	byKey := map[string]ApplicationTarget{}
	for _, target := range targets {
		target.HP = nil
		byKey[saveTargetKey(target)] = target
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx)
	if err = lockConcentrationGraph(ctx, tx); err != nil {
		return out, err
	}
	signature, _ := json.Marshal(req)
	hash := sha256.Sum256(signature)
	fingerprint := hex.EncodeToString(hash[:])
	eventID := req.EventID
	var raw json.RawMessage
	var actorID int64
	action := "Урон из боя"
	data := map[string]any{}
	if eventID == 0 {
		err = tx.QueryRow(ctx, `SELECT id,data FROM dndshare.session_event WHERE session_id=$1 AND client_action_id=$2::uuid`, sessionID, req.ClientActionID).Scan(&eventID, &raw)
		if err == nil {
			if json.Unmarshal(raw, &data) != nil || data["impactRequest"] != fingerprint {
				return out, ErrApplication
			}
			out.Event, err = scanSessionEvent(tx.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
			return out, err
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return out, err
		}
		if req.EffectKey != "" {
			return out, ErrApplication
		}
		err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility,client_action_id) VALUES($1,$2,'damage_applied',$3,'{}','public',$4::uuid) RETURNING id`, sessionID, userID, action, req.ClientActionID).Scan(&eventID)
		if err != nil {
			return out, err
		}
		data["impactRequest"] = fingerprint
	} else {
		err = tx.QueryRow(ctx, `SELECT data,COALESCE(actor_char_id,0),action FROM dndshare.session_event WHERE id=$1 AND session_id=$2 AND NOT deleted FOR UPDATE`, eventID, sessionID).Scan(&raw, &actorID, &action)
		if err != nil {
			return out, err
		}
		if json.Unmarshal(raw, &data) != nil {
			return out, ErrApplication
		}
		receipts := object(data["impactRequests"])
		if previous, ok := receipts[req.ClientActionID]; ok {
			if previous != fingerprint {
				return out, ErrApplication
			}
			out.Event, err = scanSessionEvent(tx.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
			return out, err
		}
		receipts[req.ClientActionID] = fingerprint
		data["impactRequests"] = receipts
	}
	var damageData map[string]any
	if req.EventID > 0 {
		damageData = data
	}
	parts, err := impactDamageParts(ctx, tx, damageData, req.Amount)
	if err != nil {
		return out, err
	}
	if len(parts) == 0 && req.EffectKey == "" {
		for _, choice := range req.Targets {
			if choice.Outcome != "success" {
				return out, ErrApplication
			}
		}
	}
	// Validate all targets before changing concentration or HP.
	seen := map[string]bool{}
	existing := map[string]bool{}
	for _, v := range array(data["impacts"]) {
		existing[textValue(object(v)["key"])] = true
	}
	for _, choice := range req.Targets {
		key := saveTargetKey(choice.Target)
		if _, ok := byKey[key]; !ok || seen[key] || existing[key] {
			return out, fmt.Errorf("%w: цель недоступна или результат уже применён", ErrApplication)
		}
		if choice.Outcome != "" && choice.Outcome != "success" && choice.Outcome != "failure" {
			return out, ErrApplication
		}
		if choice.Outcome != "" {
			found := false
			for _, v := range array(object(data["savingThrow"])["results"]) {
				if object(v)["key"] == key {
					found = true
				}
			}
			if !found {
				return out, ErrApplication
			}
		}
		seen[key] = true
	}
	applyEffects := false
	for _, choice := range req.Targets {
		applyEffects = applyEffects || choice.Outcome != "success"
	}
	effectKey := req.EffectKey
	if !applyEffects {
		effectKey = ""
	}
	plan, err := impactEffectPlan(ctx, tx, userID, actorID, data, effectKey, req.ClientActionID, applyEffects)
	if err != nil {
		return out, err
	}
	if actorID > 0 {
		out.CharacterIDs = append(out.CharacterIDs, actorID)
	}
	for index, choice := range req.Targets {
		target := byKey[saveTargetKey(choice.Target)]
		doc, npc, npcData, err := impactTargetDocument(ctx, tx, sessionID, &target)
		if err != nil {
			return out, err
		}
		maximum := 0
		if npc != nil {
			maximum = number(object(doc.values()["hp"])["max"])
		} else {
			maximum, err = applicationHPMaximum(ctx, tx, doc.values())
			if err != nil {
				return out, err
			}
			out.CharacterIDs = append(out.CharacterIDs, target.CharID)
		}
		var manualStates []any
		if npc != nil {
			manualStates = array(npc.combatant["states"])
		}
		defenses, err := impactDefenses(ctx, tx, doc.values(), npcData, manualStates)
		if err != nil {
			return out, err
		}
		multiplier := 1.0
		if choice.Outcome == "success" {
			multiplier = 0
			if object(data["savingThrow"])["onSuccess"] == "half" {
				multiplier = 0.5
			}
		}
		result := applyImpactDamage(doc, parts, defenses, multiplier, maximum)
		if len(plan.Effects) > 0 && choice.Outcome != "success" {
			applied, err := applyApplication(doc, plan, fmt.Sprintf("impact-%s-%d", req.ClientActionID, index), secureApplicationDie)
			if err != nil {
				return out, err
			}
			result.Effects = applied.Effects
			if err = linkConcentrationEffects(ctx, tx, doc, plan, target); err != nil {
				return out, err
			}
		}
		result.Key = saveTargetKey(target)
		result.Target = target
		result.EventID = eventID
		result.Action = action
		result.CreatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		encoded, _ := json.Marshal(result)
		var record map[string]any
		_ = json.Unmarshal(encoded, &record)
		record["outcome"] = choice.Outcome
		if npc != nil {
			appendNPCHistory(npc.combatant, record)
			npc.historyHandled = true
			err = npc.save(ctx, tx, doc)
		} else {
			err = saveTransferDocument(ctx, tx, target.CharID, doc)
		}
		if err != nil {
			return out, err
		}
		data["impacts"] = append(array(data["impacts"]), record)
	}
	raw, err = json.Marshal(data)
	if err != nil {
		return out, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=CAST($2 AS jsonb) WHERE id=$1`, eventID, raw); err != nil {
		return out, err
	}
	if err = tx.Commit(ctx); err != nil {
		return out, err
	}
	out.Event, err = scanSessionEvent(s.pool.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
	return out, err
}

func impactTargetDocument(ctx context.Context, tx pgx.Tx, sessionID int64, target *ApplicationTarget) (transferDocument, *npcApplicationDocument, map[string]any, error) {
	if target.Kind == "npc" {
		npc, err := loadNPCApplication(ctx, tx, sessionID, *target)
		if err != nil {
			return nil, nil, nil, err
		}
		data := map[string]any{}
		if id := int64(number(npc.combatant["itemId"])); id > 0 {
			_, data, _, err = applicationItem(ctx, tx, id)
			if err != nil {
				return nil, nil, nil, err
			}
		}
		return npc.document, npc, data, nil
	}
	var raw json.RawMessage
	err := tx.QueryRow(ctx, `SELECT c.id,c.data FROM dndshare."char" c JOIN dndshare.session_participant p ON p.char_id=c.id WHERE c.uuid=$1::uuid AND p.session_id=$2 AND NOT c.deleted FOR UPDATE OF c`, target.CharUUID, sessionID).Scan(&target.CharID, &raw)
	if err != nil {
		return nil, nil, nil, ErrNotFound
	}
	doc, err := decodeTransferDocument(raw)
	return doc, nil, nil, err
}
