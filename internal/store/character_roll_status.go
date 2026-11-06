package store

import (
	"dndshare/internal/documentpatch"
	"encoding/json"
)

// Freeze both outcomes on the same states snapshot as the roll. The session draws the d20
// and applies one outcome inside the receipt transaction, including on a network retry.
type CharacterStatusSave struct {
	DC      int             `json:"dc"`
	Before  json.RawMessage `json:"before"`
	Success json.RawMessage `json:"success"`
	Failure json.RawMessage `json:"failure"`
}

func (s *CharacterStatusSave) valid() bool {
	if s.DC < 1 || s.DC > 100 {
		return false
	}
	for _, raw := range []json.RawMessage{s.Before, s.Success, s.Failure} {
		var rows []map[string]any
		if len(raw) > 256*1024 || json.Unmarshal(raw, &rows) != nil || rows == nil {
			return false
		}
	}
	return true
}

func (s *CharacterStatusSave) resolve(data json.RawMessage, total int) (json.RawMessage, error) {
	if s == nil {
		return data, nil
	}
	var doc struct {
		Values struct {
			States json.RawMessage `json:"states"`
		} `json:"values"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	old, err := documentpatch.Decode(s.Before)
	if err != nil {
		return nil, ErrApplication
	}
	current, err := documentpatch.Decode(doc.Values.States)
	if err != nil || !documentpatch.Equal(old, current) {
		return nil, ErrCharacterVersion
	}
	next := s.Failure
	if total >= s.DC {
		next = s.Success
	}
	return documentpatch.Apply(data, []documentpatch.Operation{{Op: "set", Path: []any{"values", "states"}, Value: next}})
}
