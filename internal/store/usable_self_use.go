package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

// The receipt and character mutation commit together. A repeated action UUID
// returns its original dice even if the last dose has already disappeared.
func (s *Store) UseItemSelf(ctx context.Context, userID, charID, version int64, entryUID, actionID, option, source string) (ApplicationResult, error) {
	result := ApplicationResult{}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if err = lockConcentrationGraph(ctx, tx); err != nil {
		return result, err
	}
	var c transferCharacter
	err = tx.QueryRow(ctx, `SELECT id,user_id,version,data FROM dndshare."char" WHERE id=$1 AND deleted=false FOR UPDATE`, charID).Scan(&c.ID, &c.UserID, &c.Version, &c.Data)
	if errors.Is(err, pgx.ErrNoRows) || c.UserID != userID {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	var raw json.RawMessage
	var previousUID, previousOption, previousSource string
	err = tx.QueryRow(ctx, `SELECT entry_uid,option_key,source,result FROM dndshare.item_application WHERE char_id=$1 AND client_action_id=$2::uuid`, charID, actionID).Scan(&previousUID, &previousOption, &previousSource, &raw)
	if err == nil {
		if previousUID != entryUID || previousOption != option || previousSource != source {
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
	entry, err := doc.takeUsableUnit(source, entryUID)
	if err != nil {
		return result, err
	}
	plan, err := buildUsableApplication(ctx, tx, entry, option, userID)
	if err != nil {
		return result, err
	}
	result, err = applyApplicationTx(ctx, tx, doc, plan, actionID)
	if err != nil {
		return result, err
	}
	if err = saveTransferDocument(ctx, tx, charID, doc); err != nil {
		return result, err
	}
	raw, err = json.Marshal(result)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.item_application(char_id,client_action_id,entry_uid,option_key,result,source) VALUES($1,$2::uuid,$3,$4,CAST($5 AS jsonb),$6)`, charID, actionID, entryUID, option, json.RawMessage(raw), source)
	if err != nil {
		return result, err
	}
	eventData, _ := json.Marshal(map[string]any{"purpose": "use", "status": "accepted", "source": map[string]any{"itemId": plan.ItemID, "name": plan.Name}, "applicationResult": result})
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id)
 SELECT p.session_id,$2,$1,$3,'item_spent',$4,CAST($5 AS jsonb),'public',$6::uuid FROM dndshare.session_participant p JOIN dndshare."session" s ON s.id=p.session_id WHERE p.char_id=$1 AND s.deleted=false`, charID, userID, characterName(c.Data), "Применено: "+plan.Name, json.RawMessage(eventData), actionID)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
