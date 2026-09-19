package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func (s *Store) UseSpellSelf(ctx context.Context, userID, charID, version, spellID int64, option, actionID string) (ApplicationResult, error) {
	result := ApplicationResult{}
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
	c := chars[charID]
	if c.UserID != userID {
		return result, ErrNotFound
	}
	var raw json.RawMessage
	var previousUID, previousOption string
	entryUID := fmt.Sprintf("spell:%d", spellID)
	err = tx.QueryRow(ctx, `SELECT entry_uid,option_key,result FROM dndshare.item_application WHERE char_id=$1 AND client_action_id=$2::uuid`, charID, actionID).Scan(&previousUID, &previousOption, &raw)
	if err == nil {
		if previousUID != entryUID || previousOption != option {
			return result, ErrItemTransferConflict
		}
		if err = json.Unmarshal(raw, &result); err != nil {
			return result, err
		}
		return result, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if c.Version != version {
		return result, ErrCharacterVersion
	}
	doc, err := decodeTransferDocument(c.Data)
	if err != nil {
		return result, err
	}
	if allowed, err := canUseApplicationSpell(ctx, tx, doc.values(), int(spellID)); err != nil {
		return ApplicationResult{}, err
	} else if !allowed {
		return result, ErrNotFound
	}
	plan, err := buildCatalogueApplication(ctx, tx, map[string]any{"item_id": int(spellID)}, option, userID, 5, "cast")
	if err != nil {
		return result, err
	}
	if applicationNeedsConcentration(plan) {
		plan.ConcentrationID, err = beginConcentrationTx(ctx, tx, charID, spellID, plan.Name, actionID, true)
		if err != nil {
			return result, err
		}
		if err = tx.QueryRow(ctx, `SELECT data FROM dndshare."char" WHERE id=$1`, charID).Scan(&raw); err != nil {
			return result, err
		}
		doc, err = decodeTransferDocument(raw)
		if err != nil {
			return result, err
		}
	}
	result, err = applyApplicationTx(ctx, tx, doc, plan, actionID)
	if err != nil {
		return result, err
	}
	if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
		return result, err
	}
	var uuid string
	if err = tx.QueryRow(ctx, `SELECT uuid::text FROM dndshare."char" WHERE id=$1`, charID).Scan(&uuid); err != nil {
		return result, err
	}
	if err = linkConcentrationEffects(ctx, tx, doc, plan, ApplicationTarget{Kind: "character", CharID: charID, CharUUID: uuid, Name: characterName(c.Data)}); err != nil {
		return result, err
	}
	raw, _ = json.Marshal(result)
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_application(char_id,client_action_id,entry_uid,option_key,result) VALUES($1,$2::uuid,$3,$4,CAST($5 AS jsonb))`, charID, actionID, entryUID, option, json.RawMessage(raw)); err != nil {
		return result, err
	}
	eventData, _ := json.Marshal(map[string]any{"source": map[string]any{"itemId": spellID, "name": plan.Name}, "applicationResult": result})
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id)
 SELECT p.session_id,$2,$1,$3,'status_effect',$4,CAST($5 AS jsonb),'public',$6::uuid FROM dndshare.session_participant p JOIN dndshare."session" s ON s.id=p.session_id WHERE p.char_id=$1 AND s.deleted=false`, charID, userID, characterName(c.Data), "Применено: "+plan.Name, json.RawMessage(eventData), actionID)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
