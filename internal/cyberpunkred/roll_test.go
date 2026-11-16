package cyberpunkred

import (
	"encoding/json"
	"testing"
)

func testCharacter() json.RawMessage {
	return json.RawMessage(`{"system":"cyberpunk-red","schemaVersion":1,"values":{"identity":{"handle":"Test"},"stats":{"INT":6,"REF":8,"DEX":6,"TECH":6,"COOL":6,"WILL":6,"LUCK":5,"MOVE":6,"BODY":6,"EMP":6},"health":{"current":40,"deathSavePenalty":0},"humanity":{"current":60},"luck":{"current":5},"skills":[{"uid":"handgun","key":"handgun","rank":6}],"roles":[{"uid":"runner","key":"netrunner","rank":4}],"inventory":{"entries":[{"uid":"gun","key":"weapon-heavy-pistol","equipped":true,"loaded":8}]},"netrunning":{"connected":true,"actionsRemaining":3},"cyberware":{"installations":[]}}}`)
}
func fixedDice(values ...int) func(int) int {
	i := 0
	return func(int) int { v := values[i]; i++; return v }
}
func TestRedCriticalAndLuck(t *testing.T) {
	dv := 23
	next, result, err := Resolve(testCharacter(), RollRequest{Kind: "check", SkillKey: "handgun", SkillUID: "handgun", Luck: 2, DV: &dv}, nil, fixedDice(10, 10))
	if err != nil || result.Total != 36 || result.Success == nil || !*result.Success || len(result.Dice) != 2 {
		t.Fatal(result, err)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	if num(object(object(doc["values"])["luck"])["current"]) != 3 {
		t.Fatal("LUCK not spent")
	}
	_, result, err = Resolve(testCharacter(), RollRequest{Kind: "check", SkillKey: "handgun", SkillUID: "handgun"}, nil, fixedDice(1, 10))
	if err != nil || result.Total != 5 {
		t.Fatal(result, err)
	}
}
func TestRedAttackConsumesOnlySavedAmmo(t *testing.T) {
	facts := map[string]map[string]any{"weapon-heavy-pistol": {"ranged": true, "skill": "handgun", "damage": "3d6", "magazine": float64(8), "quality": "standard"}}
	next, result, err := Resolve(testCharacter(), RollRequest{Kind: "attack", EntryUID: "gun"}, facts, fixedDice(5))
	if err != nil || result.Total != 19 || result.AmmoSpent != 1 {
		t.Fatal(result, err)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	if num(find(object(object(doc["values"])["inventory"])["entries"], "uid", "gun")["loaded"]) != 7 {
		t.Fatal("ammo count")
	}
	_, _, err = Resolve(testCharacter(), RollRequest{Kind: "attack", EntryUID: "foreign"}, facts, fixedDice(5))
	if err == nil {
		t.Fatal("foreign weapon accepted")
	}
}
func TestRedDeathAndInterfaceAreSeparate(t *testing.T) {
	_, result, err := Resolve(testCharacter(), RollRequest{Kind: "initiative"}, nil, fixedDice(10, 5))
	if err != nil || result.Total != 23 || len(result.Dice) != 2 {
		t.Fatal(result, err)
	}
	_, result, err = Resolve(testCharacter(), RollRequest{Kind: "death"}, nil, fixedDice(10))
	if err != nil || result.Success == nil || *result.Success {
		t.Fatal(result, err)
	}
	_, _, err = Resolve(testCharacter(), RollRequest{Kind: "death", Luck: 1}, nil, fixedDice(1))
	if err == nil {
		t.Fatal("luck on death")
	}
	next, result, err := Resolve(testCharacter(), RollRequest{Kind: "interface"}, nil, fixedDice(5))
	if err != nil || result.Total != 9 {
		t.Fatal(result, err)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	if num(object(object(doc["values"])["netrunning"])["actionsRemaining"]) != 2 {
		t.Fatal("NET actions")
	}
}
