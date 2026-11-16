package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"dndshare/internal/cyberpunkred"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"math/big"
)

type RedRollReceipt struct {
	Version int64                   `json:"version"`
	Roll    cyberpunkred.RollResult `json:"roll"`
	EventID int64                   `json:"eventId"`
}

func (s *Store) RollRedCharacter(ctx context.Context, userID, charID int64, request cyberpunkred.RollRequest) (RedRollReceipt, error) {
	result := RedRollReceipt{}
	signed := request
	signed.Version = 0
	hash := fmt.Sprintf("red-roll:%x", sha256.Sum256(rawCharacterJSON(signed)))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	var raw json.RawMessage
	var owner, version int64
	var template string
	err = tx.QueryRow(ctx, `SELECT c.data,c.user_id,c.version,t.name FROM dndshare."char" c JOIN dndshare.char_template t ON t.id=c.template_id WHERE c.id=$1 AND NOT c.deleted FOR UPDATE OF c`, charID).Scan(&raw, &owner, &version, &template)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && template != "CYBERPUNK_RED" {
		return result, ErrNotFound
	}
	if err != nil {
		return result, err
	}
	if owner != userID {
		var allowed bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.session_participant p JOIN dndshare."session" s ON s.id=p.session_id WHERE p.char_id=$1 AND s.owner_user_id=$2 AND NOT s.deleted)`, charID, userID).Scan(&allowed); err != nil {
			return result, err
		}
		if !allowed {
			return result, ErrNotFound
		}
	}
	previous, err := scanCharacterChange(tx.QueryRow(ctx, `SELECT `+characterChangeColumns+` FROM dndshare.character_change WHERE char_id=$1 AND mutation_id=$2::uuid`, charID, request.ActionID))
	if err == nil {
		if previous.RequestHash != hash || previous.AuthorUserID == nil || *previous.AuthorUserID != userID {
			return result, ErrItemTransferConflict
		}
		var entries []struct {
			Receipt *RedRollReceipt `json:"redReceipt"`
		}
		if json.Unmarshal(previous.Metadata, &entries) != nil || len(entries) != 1 || entries[0].Receipt == nil {
			return result, ErrApplication
		}
		return *entries[0].Receipt, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if request.Version != version {
		return result, ErrCharacterVersion
	}
	// Only this system's public or the actor's own catalogue records are visible.
	rows, err := tx.Query(ctx, `SELECT i.id,i.user_id IS NOT NULL,i.data FROM dndshare.active_item i JOIN dndshare.item_type t ON t.id=i.type_id JOIN dndshare.source s ON s.id=t.source_id WHERE s.name='Cyberpunk' AND (i.user_id IS NULL OR i.user_id=$1)`, owner)
	if err != nil {
		return result, err
	}
	facts := map[string]map[string]any{}
	for rows.Next() {
		var data struct {
			Key   string         `json:"red_key"`
			Facts map[string]any `json:"facts"`
		}
		var bytes []byte
		var itemID int64
		var custom bool
		if err = rows.Scan(&itemID, &custom, &bytes); err != nil {
			rows.Close()
			return result, err
		}
		if err = json.Unmarshal(bytes, &data); err != nil {
			rows.Close()
			return result, err
		}
		if custom {
			data.Key = fmt.Sprintf("custom-%d", itemID)
		}
		if data.Key != "" {
			facts[data.Key] = data.Facts
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	var sessionID int64
	if request.SessionUUID != "" {
		err = tx.QueryRow(ctx, `SELECT s.id FROM dndshare."session" s JOIN dndshare.session_participant p ON p.session_id=s.id WHERE s.uuid=$1::uuid AND p.char_id=$2 AND NOT s.deleted AND (p.user_id=$3 OR s.owner_user_id=$3) FOR UPDATE OF s`, request.SessionUUID, charID, userID).Scan(&sessionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return result, ErrNotFound
		}
		if err != nil {
			return result, err
		}
	}
	var randomError error
	next, roll, err := cyberpunkred.Resolve(raw, request, facts, func(sides int) int {
		n, e := rand.Int(rand.Reader, big.NewInt(int64(sides)))
		if e != nil {
			randomError = e
			return 0
		}
		return int(n.Int64()) + 1
	})
	if randomError != nil {
		return result, randomError
	}
	if err != nil {
		return result, fmt.Errorf("%w: %v", ErrApplication, err)
	}
	result.Roll = roll
	result.Version = version + 1
	if sessionID != 0 {
		event := map[string]any{"kind": request.Kind, "system": "cyberpunk-red", "title": request.Title, "result": map[string]any{"total": roll.Total, "expression": roll.Expression, "parts": redDiceParts(roll), "byType": []any{}}, "red": roll}
		if request.Kind == "initiative" {
			event["sheetInitiative"] = true
		}
		if request.Kind == "damage" {
			event["damageRoll"] = true
			event["redDamage"] = roll.DamageOptions
		}
		err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id) VALUES($1,$2,$3,$4,'dice_roll',$5,$6::jsonb,'public',$7::uuid) RETURNING id`, sessionID, userID, charID, characterName(next), request.Title, rawCharacterJSON(event), request.ActionID).Scan(&result.EventID)
		if err != nil {
			return result, err
		}
	}
	ctx = WithDocumentMutation(WithDocumentActor(ctx, userID), request.ActionID, hash, rawCharacterJSON([]any{map[string]any{"redReceipt": result}}))
	if _, err = persistCharacterDocument(ctx, tx, charID, next, &version); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func redDiceParts(roll cyberpunkred.RollResult) []any {
	parts := []any{}
	if roll.DamageOptions != nil {
		return []any{map[string]any{"kind": "flat", "value": roll.Total, "sum": roll.Total, "sign": "+", "operator": "+"}}
	}
	for index, die := range roll.Dice {
		sides := roll.DiceSides
		if sides == 0 {
			sides = 10
		}
		sign := "+"
		if index == 1 && roll.Critical == "failure" {
			sign = "-"
		}
		parts = append(parts, map[string]any{"kind": "dice", "n": 1, "sides": sides, "rolls": []int{die}, "sum": die, "sign": sign, "operator": sign})
	}
	base := roll.Base
	sign := "+"
	if base < 0 {
		sign = "-"
		base = -base
	}
	parts = append(parts, map[string]any{"kind": "flat", "value": base, "sum": base, "sign": sign, "operator": sign})
	return parts
}
