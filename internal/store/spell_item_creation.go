package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type CreatedApplicationItem struct {
	ItemID   int64          `json:"itemId"`
	Name     string         `json:"name"`
	UID      string         `json:"uid"`
	Count    int            `json:"count"`
	Duration map[string]any `json:"duration,omitempty"`
}

func spellCreationOption(data map[string]any, key string) (map[string]any, error) {
	var found map[string]any
	for _, raw := range array(data["item_creation"]) {
		option := object(raw)
		if key != "" && textValue(option["key"]) == key {
			if found != nil {
				return nil, ErrApplication
			}
			found = option
		}
	}
	if found == nil || len(array(found["outputs"])) < 1 || len(array(found["outputs"])) > 20 {
		return nil, fmt.Errorf("%w: не найден вариант создания предметов", ErrApplication)
	}
	return found, nil
}

// Build each output from a visible catalogue item. Quantity, lifetime and source
// belong to the cast; editing a catalogue item cannot change existing copies.
func createSpellItems(ctx context.Context, tx pgx.Tx, doc transferDocument, userID int64, data map[string]any, r SpellCastRequest) ([]CreatedApplicationItem, error) {
	option, err := spellCreationOption(data, r.CreationKey)
	if err != nil {
		return nil, err
	}
	outputs := array(option["outputs"])
	if r.CreatedCount < 0 || r.CreatedCount > 999 || r.CreatedCount > 0 && (option["choose_count"] != true || len(outputs) != 1) {
		return nil, ErrApplication
	}
	created := []CreatedApplicationItem{}
	for i, raw := range outputs {
		output := object(raw)
		id := int64(number(output["item"]))
		name, _, kind, e := visibleApplicationItem(ctx, tx, id, userID)
		if e != nil {
			return nil, e
		}
		switch kind {
		case 1, 2, 10, 12, 13, 14, 19:
		default:
			return nil, ErrApplication
		}
		count := number(output["count"])
		if output["count"] == nil {
			count = 1
		}
		count += max(0, r.CastLevel-number(data["lvl"])) / max(1, number(output["scaling_step"])) * max(0, number(output["per_slot"]))
		if count < 1 || count > 999 {
			return nil, ErrApplication
		}
		if r.CreatedCount > 0 {
			if r.CreatedCount > count {
				return nil, ErrApplication
			}
			count = r.CreatedCount
		}
		duration := object(output["duration"])
		if err = validateApplicationDuration(duration); err != nil {
			return nil, err
		}
		if duration["formula"] != nil {
			return nil, ErrApplication
		}
		uid := castTargetAction(r.ClientActionID, i)
		creation := map[string]any{"cast_id": r.ClientActionID, "spell_id": r.SpellID, "duration": duration, "expired": false}
		entry := map[string]any{"uid": uid, "item_id": id, "count": count, "params": map[string]any{"creation": creation}}
		doc.receive("items", entry, false, uid)
		created = append(created, CreatedApplicationItem{ItemID: id, Name: name, UID: uid, Count: count, Duration: duration})
	}
	return created, nil
}
