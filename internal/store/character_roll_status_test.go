package store

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestStatusSaveResolvesOnlyOnTheFrozenSheet(t *testing.T) {
	before := json.RawMessage(`[{"uid":"poison","params":{"damage_dice":2}}]`)
	s := CharacterStatusSave{DC: 14, Before: before, Failure: before, Success: json.RawMessage(`[]`)}
	if !s.valid() {
		t.Fatal("valid session save rejected")
	}
	doc := json.RawMessage(`{"values":{"states":[{"params":{"damage_dice":2},"uid":"poison"}],"hp":20}}`)
	for _, tc := range []struct{ total, remain int }{{13, 1}, {14, 0}} {
		next, err := s.resolve(doc, tc.total)
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Values struct {
				States []any
				HP     int
			}
		}
		if err := json.Unmarshal(next, &result); err != nil || len(result.Values.States) != tc.remain || result.Values.HP != 20 {
			t.Fatalf("wrong outcome: %s (%v)", next, err)
		}
	}
	if _, err := s.resolve(json.RawMessage(`{"values":{"states":[]}}`), 15); !errors.Is(err, ErrCharacterVersion) {
		t.Fatalf("stale state accepted: %v", err)
	}
	s.Success = json.RawMessage(`{"not":"a state list"}`)
	if s.valid() {
		t.Fatal("invalid outcome accepted")
	}
}
