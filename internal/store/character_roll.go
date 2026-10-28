package store

import (
	"context"
	"crypto/sha256"
	"dndshare/internal/documentpatch"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
)

// Character state, karmic balance, roll and chronicle share one receipt and commit.
// A lost response cannot consume a resource or draw another d20 on retry.
func (s *Store) RollCharacter(ctx context.Context, userID, charID int64, r CharacterRollRequest) (CharacterRollResult, error) {
	var result CharacterRollResult
	if !ValidCharacterRoll(r) {
		return result, ErrApplication
	}
	signature := r
	signature.Version = 0
	raw, _ := json.Marshal(signature)
	hash := fmt.Sprintf("character-roll:%x", sha256.Sum256(raw))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	var owner, version int64
	var data json.RawMessage
	var uuid string
	err = tx.QueryRow(ctx, `SELECT user_id,version,data,uuid::text FROM dndshare."char" WHERE id=$1 AND NOT deleted FOR UPDATE`, charID).Scan(&owner, &version, &data, &uuid)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && owner != userID {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	old, err := scanCharacterChange(tx.QueryRow(ctx, `SELECT `+characterChangeColumns+` FROM dndshare.character_change WHERE char_id=$1 AND mutation_id=$2::uuid`, charID, r.ClientActionID))
	if err == nil {
		if old.RequestHash != hash || old.AuthorUserID == nil || *old.AuthorUserID != userID {
			return result, ErrItemTransferConflict
		}
		var metadata []struct {
			Receipt *CharacterRollResult `json:"diceReceipt"`
		}
		if json.Unmarshal(old.Metadata, &metadata) != nil || len(metadata) != 1 || metadata[0].Receipt == nil {
			return result, ErrApplication
		}
		return *metadata[0].Receipt, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if version != r.Version {
		return result, ErrCharacterVersion
	}
	decoded, err := documentpatch.Decode(data)
	if err != nil {
		return result, err
	}
	if _, ok := decoded.(map[string]any); !ok {
		return result, ErrApplication
	}
	for _, before := range r.Before {
		value, exists, err := documentpatch.Lookup(decoded, before.Path)
		if err != nil {
			return result, ErrApplication
		}
		if exists != before.Exists {
			return result, ErrCharacterVersion
		}
		if exists {
			expected, err := documentpatch.Decode(before.Value)
			if err != nil {
				return result, ErrApplication
			}
			if !documentpatch.Equal(value, expected) {
				return result, ErrCharacterVersion
			}
		}
	}
	next, err := documentpatch.Apply(data, r.Patches)
	if err != nil {
		return result, ErrApplication
	}
	completeWeaponUse, err := prepareCharacterWeaponUse(next, r.WeaponUse, r.Prepared)
	if err != nil {
		return result, err
	}
	var sessionID, sessionOwner int64
	var settings SessionSettings
	err = tx.QueryRow(ctx, `SELECT id,owner_user_id,settings FROM dndshare."session" WHERE uuid=$1::uuid AND NOT deleted FOR UPDATE`, r.SessionUUID).Scan(&sessionID, &sessionOwner, &settings)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	var participant int64
	err = tx.QueryRow(ctx, `SELECT user_id FROM dndshare.session_participant WHERE session_id=$1 AND char_id=$2`, sessionID, charID).Scan(&participant)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && participant != userID && sessionOwner != userID {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	var duplicate bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.session_event WHERE session_id=$1 AND client_action_id=$2::uuid)`, sessionID, r.ClientActionID).Scan(&duplicate); err != nil {
		return result, err
	}
	if duplicate {
		return result, ErrItemTransferConflict
	}
	dice, err := rollSessionD20Tx(ctx, tx, sessionID, settings.KarmicDice, "char:"+uuid, characterName(next), r.Prepared.Mode, nil)
	if err != nil {
		return result, err
	}
	result.Roll = resolveCharacterD20(r.Prepared, dice)
	next, err = completeWeaponUse(result.Roll)
	if err != nil {
		return CharacterRollResult{}, err
	}
	event := characterRollEvent(r.Prepared, result.Roll)
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id)
 VALUES($1,$2,$3,$4,'dice_roll',$5,CAST($6 AS jsonb),'public',$7::uuid) RETURNING id`, sessionID, userID, charID, characterName(next), r.Prepared.Request.Title, rawCharacterJSON(event), r.ClientActionID).Scan(&result.EventID)
	if err != nil {
		return result, err
	}
	result.Version = version + 1
	metadata := rawCharacterJSON([]any{map[string]any{"roll": event, "diceReceipt": result}})
	ctx = WithDocumentMutation(WithDocumentActor(ctx, userID), r.ClientActionID, hash, metadata)
	if _, err = persistCharacterDocument(ctx, tx, charID, next, &version); err != nil {
		return CharacterRollResult{}, err
	}
	return result, tx.Commit(ctx)
}
