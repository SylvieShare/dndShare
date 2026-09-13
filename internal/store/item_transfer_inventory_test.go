package store

import (
	"encoding/json"
	"testing"
)

func TestTransferWeaponPreservesInstanceAndOtherValues(t *testing.T) {
	doc, err := decodeTransferDocument(json.RawMessage(`{"values":{"weapon":[{"uid":"blade","item_id":11,"magic_item_id":19,"desc":"Особый клинок","add_attacks":[{"count":2}],"proficient":true,"params":{"magic":{"attuned":true,"remaining":1,"selected_target":{"name":"Враг"},"use_cooldowns":{"wish":4}}}},{"uid":"other","item_id":12}],"hp":{"current":7}}}`))
	if err != nil {
		t.Fatal(err)
	}
	entry, err := doc.take("weapon", "blade")
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.values()["weapon"].([]any)) != 1 || doc.values()["hp"].(map[string]any)["current"] != float64(7) {
		t.Fatal("unrelated state changed")
	}
	recipient, _ := decodeTransferDocument(json.RawMessage(`{"values":{"weapon":[]}}`))
	recipient.receive("weapon", entry, true, "transfer-9")
	received := recipient.values()["weapon"].([]any)[0].(map[string]any)
	if received["uid"] != "transfer-9" || received["magic_item_id"] != float64(19) || received["desc"] != "Особый клинок" || len(received["add_attacks"].([]any)) != 1 || received["proficient"] != false {
		t.Fatalf("instance lost: %+v", received)
	}
	magic := received["params"].(map[string]any)["magic"].(map[string]any)
	if magic["selected_target"] != nil || magic["attuned"] != nil || magic["remaining"] != float64(1) || magic["use_cooldowns"] == nil {
		t.Fatalf("wrong personal/resource state: %+v", magic)
	}
}
func TestTransferCustomBagEntryAndInvalidSource(t *testing.T) {
	doc, _ := decodeTransferDocument(json.RawMessage(`{"values":{"items":{"equipped":[],"sections":[{"id":"first","items":[]},{"id":"second","items":[{"uid":"custom","count":4,"override":{"name":"Самоцвет"},"params":{"weight":2}}]}]}}}`))
	if _, err := doc.take("abilities", "custom"); err != ErrItemTransferConflict {
		t.Fatal("invalid source accepted")
	}
	entry, err := doc.take("items", "custom")
	if err != nil {
		t.Fatal(err)
	}
	doc.receive("items", entry, false, "")
	sections := doc.values()["items"].(map[string]any)["sections"].([]any)
	first := sections[0].(map[string]any)["items"].([]any)
	if len(first) != 1 || len(sections[1].(map[string]any)["items"].([]any)) != 0 || first[0].(map[string]any)["count"] != float64(4) {
		t.Fatalf("wrong return: %+v", sections)
	}
}
