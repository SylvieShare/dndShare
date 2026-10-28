package store

import "testing"

func TestPreparedCharacterRollKeepsNaturalDiceAndFrozenBonuses(t *testing.T) {
	p := PreparedCharacterD20{Request: CharacterRollSpec{Title: "Проверка", Kind: "ability_check"}, Mode: "advantage", Flat: 3, BonusDice: []int{1}, BonusTotal: 1, BonusExpression: "1d4", MinimumRule: map[string]any{"value": 10, "label": "Талант"}, BonusParts: []map[string]any{{"kind": "dice", "sides": 4, "n": 1, "rolls": []int{1}, "sum": 1}}}
	r := resolveCharacterD20(p, SessionD20Result{Rolls: []int{1, 7}})
	if number(r["total"]) != 14 || number(r["selected"]) != 7 || textValue(r["expression"]) != "2d20+3+1d4" {
		t.Fatal(r)
	}
	parts := array(r["parts"])
	if number(object(parts[0])["sum"]) != 10 || len(parts) != 3 {
		t.Fatal(parts)
	}
	event := characterRollEvent(p, r)
	if event["outcome"] != nil {
		t.Fatal("adjusted check became a fumble", event)
	}
	r = resolveCharacterD20(p, SessionD20Result{Rolls: []int{19, 3}, Karmic: true, BalanceBefore: 2, BalanceAfter: 1})
	if number(r["total"]) != 23 || len(array(r["adjustments"])) != 0 || number(object(r["karmicDice"])["before"]) != 2 {
		t.Fatal(r)
	}
}
