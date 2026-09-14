package store

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestApplicationHealingAndDuration(t *testing.T) {
	doc, _ := decodeTransferDocument(json.RawMessage(`{"values":{"hp":{"current":0,"max":{"base":10,"bonuses":[{"value":5}]},"temp":15,"ds_failure":2},"states":[{"uid":"old","effect_id":1,"concentration":false},{"uid":"concentrating","effect_id":2,"concentration":true}]}}`))
	p := ApplicationPlan{ItemID: 84, Name: "Зелье", Healing: "8d4 + 8", TemporaryHP: "10", Effects: []ApplicationEffect{{ID: 1, Name: "Рост", Data: map[string]any{"stacking": "single"}, Duration: map[string]any{"kind": "hours", "formula": "1d4"}}}}
	calls := 0
	r, err := applyApplication(doc, p, "test", func(sides int) (int, error) { calls++; return sides, nil })
	if err != nil || r.Healing.Total != 40 || r.Healing.Applied != 15 || r.TemporaryHP.Applied != 0 || calls != 9 {
		t.Fatalf("result=%+v err=%v calls=%d", r, err, calls)
	}
	hp := object(doc.values()["hp"])
	if hp["temp"] != float64(15) || hp["ds_failure"] != float64(0) {
		t.Fatal(hp)
	}
	states := array(doc.values()["states"])
	if len(states) != 2 || object(states[0])["uid"] != "concentrating" || object(object(states[1])["duration"])["value"] != float64(4) {
		t.Fatal(states)
	}
	if object(object(states[1])["source"])["item_id"] != float64(84) {
		t.Fatal(states)
	}
}

func TestApplicationConcentration(t *testing.T) {
	doc, _ := decodeTransferDocument(json.RawMessage(`{"values":{"states":[{"effect_id":2,"concentration":true},{"effect_id":3,"concentration":false}]}}`))
	p := ApplicationPlan{Effects: []ApplicationEffect{{ID: 4, Concentration: true}}}
	_, err := applyApplication(doc, p, "concentration", secureApplicationDie)
	if err != nil || len(array(doc.values()["states"])) != 2 || number(object(array(doc.values()["states"])[0])["effect_id"]) != 3 {
		t.Fatal(doc, err)
	}
}

func TestApplicationFormulaBounds(t *testing.T) {
	for _, f := range []string{"101d6", "0d6", "2d1", "9999999999999999999999d6", "d1000", "1d6;bad", "1d6-2", "NaN", "10001", ""} {
		if _, err := rollApplication(f, secureApplicationDie); !errors.Is(err, ErrApplication) {
			t.Fatalf("accepted %q: %v", f, err)
		}
	}
	for _, f := range []string{"d4", "2d4 + 2", "10"} {
		if _, err := rollApplication(f, secureApplicationDie); err != nil {
			t.Fatalf("rejected %q", f)
		}
	}
}
