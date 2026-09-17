package store

import "testing"

func TestPreparedSheetInitiative(t *testing.T) {
	doc := map[string]any{"combatants": []any{}}
	applySheetInitiative(doc, doc, 10, 7, "hero", float64(0))
	applySheetInitiative(doc, doc, 11, 7, "hero", float64(17))
	creatures := array(doc["combatants"])
	if len(creatures) != 1 || number(object(creatures[0])["initiative"]) != 17 || number(doc["sheetInitiativeCursor"]) != 11 {
		t.Fatalf("lost or duplicated prepared roll: %v", doc)
	}
	c := object(creatures[0])
	c["position"] = "combat"
	applySheetInitiative(doc, doc, 12, 7, "hero", float64(2))
	if number(c["initiative"]) != 17 || number(doc["sheetInitiativeCursor"]) != 12 {
		t.Fatalf("changed active initiative: %v", doc)
	}
	c["position"] = "dead"
	applySheetInitiative(doc, doc, 13, 7, "hero", float64(9))
	if number(c["initiative"]) != 17 {
		t.Fatal("changed dead participant")
	}
}

func TestPreparedInitiativeUsesPositionBeforePendingMove(t *testing.T) {
	old := map[string]any{"combatants": []any{map[string]any{"type": "player", "charId": 7, "position": "combat"}}}
	next := map[string]any{"combatants": []any{map[string]any{"type": "player", "charId": 7, "position": "reserve", "initiative": nil}}}
	applySheetInitiative(next, old, 20, 7, "hero", float64(16))
	if object(array(next["combatants"])[0])["initiative"] != nil {
		t.Fatal("reapplied an active-combat roll after combat ended")
	}
	old = map[string]any{"combatants": []any{map[string]any{"type": "player", "charId": 7, "position": "reserve"}}}
	c := object(array(next["combatants"])[0])
	c["position"] = "combat"
	applySheetInitiative(next, old, 21, 7, "hero", float64(18))
	if number(c["initiative"]) != 18 {
		t.Fatal("lost pending roll on entry")
	}
}
