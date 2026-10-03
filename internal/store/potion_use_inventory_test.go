package store

import (
	"encoding/json"
	"testing"
)

func potionUseDocument(t *testing.T) transferDocument {
	t.Helper()
	doc, err := decodeTransferDocument(json.RawMessage(`{"values":{"hp":{"current":5},"items":{"equipped":[],"sections":[{"id":"bag","name":"Рюкзак","items":[{"uid":"p","item_id":10,"count":3,"params":{"custom":7},"override":{"name":"Зелье","desc":"Особое"}}]}]}}}`))
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestPotionDoseReservationAndReturn(t *testing.T) {
	doc := potionUseDocument(t)
	before, _ := json.Marshal(doc)
	dose, err := doc.takeUsableUnit("items", "p")
	if err != nil {
		t.Fatal(err)
	}
	stack := potionTestEntries(doc)[0].(map[string]any)
	if stack["count"] != float64(2) || dose["count"] != float64(1) || dose["params"].(map[string]any)["custom"] != float64(7) {
		t.Fatalf("wrong reservation: %v %v", dose, stack)
	}
	doc.returnUsableUnit("items", dose, "returned-1")
	after, _ := json.Marshal(doc)
	if string(before) != string(after) {
		t.Fatalf("return changed original document: %s", after)
	}
}

func TestPotionReturnDoesNotOverwriteChangedOrMovedStack(t *testing.T) {
	for _, change := range []string{"changed", "full", "reserved"} {
		t.Run(change, func(t *testing.T) {
			doc := potionUseDocument(t)
			dose, _ := doc.takeUsableUnit("items", "p")
			stack := potionTestEntries(doc)[0].(map[string]any)
			switch change {
			case "changed":
				stack["override"] = map[string]any{"name": "Другое зелье"}
			case "full":
				stack["count"] = float64(999)
			case "reserved":
				_, _ = doc.take("items", "p")
			}
			doc.returnUsableUnit("items", dose, "returned-1")
			if change == "reserved" {
				doc.receive("items", stack, false, "")
			}
			entries := potionTestEntries(doc)
			if len(entries) != 2 || entries[0].(map[string]any)["uid"] == entries[1].(map[string]any)["uid"] {
				t.Fatalf("lost/duplicate entry: %v", entries)
			}
		})
	}
}

func TestPotionReservationRejectsEmptyOrMalformedCounts(t *testing.T) {
	for _, count := range []any{float64(0), float64(-1), float64(0.5), float64(1000), "3"} {
		doc := potionUseDocument(t)
		potionTestEntries(doc)[0].(map[string]any)["count"] = count
		if _, err := doc.takeUsableUnit("items", "p"); err != ErrItemTransferConflict {
			t.Fatalf("accepted %v", count)
		}
	}
	doc := potionUseDocument(t)
	stack := potionTestEntries(doc)[0].(map[string]any)
	delete(stack, "count")
	if _, err := doc.takeUsableUnit("items", "p"); err != nil || len(potionTestEntries(doc)) != 0 {
		t.Fatal("single uncounted dose was not reserved")
	}
	if _, err := doc.takeUsableUnit("items", "p"); err != ErrItemTransferConflict {
		t.Fatal("spent dose reserved again")
	}
}
