package store

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
)

type SpellCastRequest struct {
	CreationKey    string   `json:"creationKey,omitempty"`
	CreatedCount   int      `json:"createdCount,omitempty"`
	SpellID        int64    `json:"spellId"`
	Version        int64    `json:"version"`
	ClientActionID string   `json:"clientActionId"`
	EntryKey       string   `json:"entryKey"`
	OptionKey      string   `json:"optionKey"`
	SessionUUID    string   `json:"sessionUuid"`
	CastLevel      int      `json:"castLevel"`
	Pool           string   `json:"pool"`
	SpendSlot      bool     `json:"spendSlot"`
	Targets        []string `json:"targets"`
	DMCount        int      `json:"dmCount"`
}
type SpellCastResult struct {
	Transfers []ItemTransfer     `json:"transfers"`
	Self      *ApplicationResult `json:"self,omitempty"`
}

func castTargetAction(cast string, index int) string {
	hash := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", cast, index)))
	return fmt.Sprintf("%x-%x-%x-%x-%x", hash[:4], hash[4:6], hash[6:8], hash[8:10], hash[10:16])
}
func (s *Store) CastSpell(ctx context.Context, userID, charID int64, r SpellCastRequest) (SpellCastResult, error) {
	result := SpellCastResult{Transfers: []ItemTransfer{}}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if err = lockConcentrationGraph(ctx, tx); err != nil {
		return result, err
	}
	chars, err := lockTransferCharacters(ctx, tx, charID, charID)
	if err != nil {
		return result, err
	}
	caster := chars[charID]
	if caster.UserID != userID {
		return result, ErrNotFound
	}
	signature := r
	signature.Version = 0
	encoded, _ := json.Marshal(signature)
	var previous, jsonResult json.RawMessage
	var owner int64
	err = tx.QueryRow(ctx, `SELECT char_id,request,result FROM dndshare.spell_cast_receipt WHERE cast_id=$1::uuid`, r.ClientActionID).Scan(&owner, &previous, &jsonResult)
	if err == nil {
		var saved SpellCastRequest
		_ = json.Unmarshal(previous, &saved)
		normalized, _ := json.Marshal(saved)
		if owner != charID || string(normalized) != string(encoded) {
			return result, ErrItemTransferConflict
		}
		err = json.Unmarshal(jsonResult, &result)
		return result, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if caster.Version != r.Version {
		return result, ErrCharacterVersion
	}
	doc, err := decodeTransferDocument(caster.Data)
	if err != nil {
		return result, err
	}
	var grant map[string]any
	allowed, err := canUseApplicationSpell(ctx, tx, doc.values(), int(r.SpellID), &grant)
	if err != nil {
		return result, err
	}
	if !allowed {
		return result, ErrNotFound
	}
	name, data, kind, err := visibleApplicationItem(ctx, tx, r.SpellID, userID)
	if err != nil {
		return result, err
	}
	if kind != 5 {
		return result, ErrApplication
	}
	base := number(data["lvl"])
	reference, ability := spellCastingReference(doc.values(), r.SpellID, r.EntryKey)
	if reference == nil && grant != nil {
		reference = grant
		ability = number(grant["ability"])
		if ability == 0 {
			ability = number(object(grant["ability"])["id"])
		}
	}
	if reference == nil {
		return result, ErrApplication
	}
	if r.CastLevel < base || r.CastLevel > 9 || r.DMCount < 0 || len(r.Targets)+r.DMCount < 1 {
		return result, ErrApplication
	}
	if reference["slotless"] == true && (r.SpendSlot || r.CastLevel != max(base, number(reference["cast_level"]))) {
		return result, ErrApplication
	}
	targetRule := object(data["application_targets"])
	creating := r.CreationKey != ""
	if creating {
		if _, err = spellCreationOption(data, r.CreationKey); err != nil {
			return result, err
		}
		if r.OptionKey != "" || data["concentration"] == true {
			return result, ErrApplication
		}
		targetRule = map[string]any{"self_only": true}
	} else if r.CreatedCount != 0 {
		return result, ErrApplication
	}
	if targetRule["self_only"] == true && (r.DMCount > 0 || len(r.Targets) != 1 || r.Targets[0] != "self") {
		return result, ErrApplication
	}
	maxTargets := min(50, max(1, number(targetRule["count"]))+max(0, number(targetRule["per_slot"]))*max(0, r.CastLevel-base))
	if len(r.Targets)+r.DMCount > maxTargets {
		return result, fmt.Errorf("%w: выбрано больше целей, чем позволяет заклинание", ErrApplication)
	}
	seen := map[string]bool{}
	self := false
	destinations := []int64{}
	var sessionID int64
	if r.SessionUUID != "" {
		err = tx.QueryRow(ctx, `SELECT s.id FROM dndshare."session" s JOIN dndshare.session_participant p ON p.session_id=s.id WHERE s.uuid=$1::uuid AND s.deleted=false AND p.char_id=$2 FOR SHARE OF s,p`, r.SessionUUID, charID).Scan(&sessionID)
		if err != nil {
			return result, ErrNotFound
		}
	}
	for _, target := range r.Targets {
		if seen[target] {
			return result, ErrApplication
		}
		seen[target] = true
		if target == "self" {
			self = true
			continue
		}
		if sessionID == 0 {
			return result, ErrNotFound
		}
		var id int64
		if err = tx.QueryRow(ctx, `SELECT c.id FROM dndshare."char" c JOIN dndshare.session_participant p ON p.char_id=c.id WHERE c.uuid=$1::uuid AND c.deleted=false AND p.session_id=$2`, target, sessionID).Scan(&id); err != nil || id == charID {
			return result, ErrNotFound
		}
		destinations = append(destinations, id)
	}
	if r.DMCount > 0 && sessionID == 0 {
		return result, ErrNotFound
	}
	for i := 0; i < r.DMCount; i++ {
		destinations = append(destinations, 0)
	}
	plan := ApplicationPlan{ItemID: r.SpellID, Name: name, SourceKind: "spell", Effects: []ApplicationEffect{}}
	if !creating {
		plan, err = buildCatalogueApplication(ctx, tx, map[string]any{"item_id": int(r.SpellID)}, r.OptionKey, userID, 5, "cast")
		if err != nil {
			return result, err
		}
	}
	plan.CastID = r.ClientActionID
	plan.CastLevel = r.CastLevel
	if err = prepareSpellEffectBindings(&plan, data, doc.values(), r.CastLevel, ability); err != nil {
		return result, err
	}
	if !creating && object(data["heal"])["apply"] != false && len(array(object(data["heal"])["dices"])) > 0 {
		plan.Healing = spellHealFormula(data, doc.values(), r.CastLevel, ability)
		if _, err = rollApplication(plan.Healing, func(int) (int, error) { return 1, nil }); err != nil {
			return result, err
		}
	}
	states, changed, err := removeConcentrationStates(ctx, tx, array(doc.values()["states"]), "", false, "spell_cast")
	if err != nil {
		return result, err
	}
	if changed {
		doc.values()["states"] = states
		if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
			return result, err
		}
	}
	if r.SpendSlot {
		if base == 0 {
			return result, ErrApplication
		}
		if err = spendSpellSlot(doc, r.Pool, r.CastLevel); err != nil {
			return result, err
		}
		if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
			return result, err
		}
	}
	if applicationNeedsConcentration(plan) {
		plan.ConcentrationID, err = beginConcentrationTx(ctx, tx, charID, r.SpellID, name, r.ClientActionID, false)
		if err != nil {
			return result, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.spell_cast_receipt(cast_id,char_id,request) VALUES($1::uuid,$2,CAST($3 AS jsonb))`, r.ClientActionID, charID, json.RawMessage(encoded)); err != nil {
		return result, err
	}
	if self {
		var raw json.RawMessage
		var uuid string
		if err = tx.QueryRow(ctx, `SELECT data,uuid::text FROM dndshare."char" WHERE id=$1`, charID).Scan(&raw, &uuid); err != nil {
			return result, err
		}
		doc, err = decodeTransferDocument(raw)
		if err != nil {
			return result, err
		}
		applied := ApplicationResult{Effects: []ApplicationEffect{}}
		var e error
		if creating {
			applied.CreatedItems, e = createSpellItems(ctx, tx, doc, userID, data, r)
		} else {
			applied, e = applyApplicationTx(ctx, tx, doc, plan, r.ClientActionID)
		}
		if e != nil {
			return result, e
		}
		result.Self = &applied
		if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
			return result, err
		}
		if err = linkConcentrationEffects(ctx, tx, doc, plan, ApplicationTarget{Kind: "character", CharID: charID, CharUUID: uuid, Name: characterName(caster.Data)}); err != nil {
			return result, err
		}
	}
	for index, destination := range destinations {
		var version int64
		if err = tx.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=$1`, charID).Scan(&version); err != nil {
			return result, err
		}
		offer, e := s.createItemTransferTx(ctx, tx, userID, sessionID, charID, destination, version, "spells", fmt.Sprint(r.SpellID), castTargetAction(r.ClientActionID, index), "use", r.OptionKey, &plan)
		if e != nil {
			return result, e
		}
		result.Transfers = append(result.Transfers, offer)
	}
	event := map[string]any{"source": map[string]any{"itemId": r.SpellID, "name": name}, "castId": r.ClientActionID, "slotLevel": r.CastLevel, "targetCount": len(r.Targets) + r.DMCount}
	if save := spellSaveEvent(data, doc.values(), ability, r.SpellID, r.EntryKey); save != nil {
		event["savingThrow"] = save
	}
	if result.Self != nil {
		event["applicationResult"] = result.Self
	}
	if r.SpendSlot {
		event["resourceChanges"] = []any{map[string]any{"key": fmt.Sprintf("spell:%s:%d", r.Pool, r.CastLevel), "name": fmt.Sprintf("Ячейка %d круга", r.CastLevel), "level": r.CastLevel, "pool": r.Pool, "delta": -1}}
	}
	eventJSON, _ := json.Marshal(event)
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id) SELECT p.session_id,$2,$1,$3,'spell_used',$4,CAST($5 AS jsonb),'public',$6::uuid FROM dndshare.session_participant p JOIN dndshare."session" s ON s.id=p.session_id WHERE p.char_id=$1 AND s.deleted=false`, charID, userID, characterName(caster.Data), "Использовано: "+name, json.RawMessage(eventJSON), r.ClientActionID)
	if err != nil {
		return result, err
	}
	rawResult, _ := json.Marshal(result)
	if _, err = tx.Exec(ctx, `UPDATE dndshare.spell_cast_receipt SET result=CAST($2 AS jsonb) WHERE cast_id=$1::uuid`, r.ClientActionID, json.RawMessage(rawResult)); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
