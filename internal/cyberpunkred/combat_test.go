package cyberpunkred

import (
	"encoding/json"
	"testing"
)

func coreFacts(t *testing.T) map[string]map[string]any {
	t.Helper()
	core, err := Core()
	if err != nil {
		t.Fatal(err)
	}
	facts := map[string]map[string]any{}
	for _, i := range core.Items {
		facts[i.Key] = i.Facts
	}
	return facts
}
func editActor(edit func(map[string]any)) json.RawMessage {
	var doc map[string]any
	_ = json.Unmarshal(testCharacter(), &doc)
	edit(object(doc["values"]))
	raw, _ := json.Marshal(doc)
	return raw
}

func TestAutofireDamageUsesMarginAndOneSoloBonus(t *testing.T) {
	raw := editActor(func(v map[string]any) {
		v["skills"] = []any{map[string]any{"uid": "auto", "key": "autofire", "rank": 6}}
		v["roles"] = []any{map[string]any{"key": "solo", "rank": 4, "choices": map[string]any{"spotWeakness": 4}}}
		v["inventory"] = map[string]any{"entries": []any{map[string]any{"uid": "gun", "key": "weapon-assault-rifle", "equipped": true, "loaded": 25, "ammoUid": "ammo"}, map[string]any{"uid": "ammo", "key": "ammo-rifle-armor-piercing", "count": 0}}}
	})
	distance := 14
	facts := coreFacts(t)
	attacked, r, err := Resolve(raw, RollRequest{Kind: "attack", EntryUID: "gun", Mode: "autofire", Distance: &distance}, facts, fixedDice(8))
	if err != nil || r.Total != 22 || r.DV == nil || *r.DV != 17 || r.AmmoSpent != 10 {
		t.Fatal(r, err)
	}
	damaged, r, err := Resolve(attacked, RollRequest{Kind: "damage", EntryUID: "gun"}, facts, fixedDice(6, 6))
	if err != nil || r.Total != 52 || r.DamageOptions["critical"] != true || r.DamageOptions["ablation"] != 2 {
		t.Fatal(r, err)
	}
	if _, _, err = Resolve(damaged, RollRequest{Kind: "damage", EntryUID: "gun"}, facts, fixedDice(1)); err == nil {
		t.Fatal("duplicate damage accepted")
	}
}

func TestSpecialWeaponsAndRangeBoundaries(t *testing.T) {
	if dv, e := RangeDV("heavyPistol", 6, false); e != nil || dv != 13 {
		t.Fatal(dv, e)
	}
	if dv, e := RangeDV("heavyPistol", 7, false); e != nil || dv != 15 {
		t.Fatal(dv, e)
	}
	if _, e := RangeDV("smg", 101, true); e == nil {
		t.Fatal("out of range accepted")
	}
	facts := coreFacts(t)
	raw := editActor(func(v map[string]any) {
		e := find(object(v["inventory"])["entries"], "uid", "gun")
		e["key"] = "weapon-tsunami-arms-helix"
		e["loaded"] = 40
		e["mounted"] = true
	})
	if _, _, e := Resolve(raw, RollRequest{Kind: "attack", EntryUID: "gun", Mode: "single"}, facts, fixedDice(5)); e == nil {
		t.Fatal("Helix single shot")
	}
	_, r, e := Resolve(raw, RollRequest{Kind: "attack", EntryUID: "gun", Mode: "autofire"}, facts, fixedDice(5))
	if e != nil || r.AmmoSpent != 20 {
		t.Fatal(r, e)
	}
}

func TestMartialArtsUsesSelectedStyleAndAugmentedBody(t *testing.T) {
	facts := coreFacts(t)
	raw := editActor(func(v map[string]any) {
		object(v["stats"])["BODY"] = 12
		v["skills"] = []any{map[string]any{"uid": "karate", "key": "martial-arts", "rank": 4, "specialization": "Karate"}, map[string]any{"uid": "judo", "key": "martial-arts", "rank": 6, "specialization": "Judo"}}
		find(object(v["inventory"])["entries"], "uid", "gun")["key"] = "weapon-martial-arts"
	})
	next, r, e := Resolve(raw, RollRequest{Kind: "attack", EntryUID: "gun", SkillUID: "karate"}, facts, fixedDice(5))
	if e != nil || r.Total != 15 {
		t.Fatal(r, e)
	}
	_, r, e = Resolve(next, RollRequest{Kind: "damage", EntryUID: "gun"}, facts, fixedDice(3, 3, 3, 3))
	if e != nil || r.Total != 12 || r.DamageOptions["armorMode"] != "half" {
		t.Fatal(r, e)
	}
}

func TestNetrunTargetRestrictionAndProgramDamage(t *testing.T) {
	facts := coreFacts(t)
	raw := editActor(func(v map[string]any) {
		net := object(v["netrunning"])
		net["loadedPrograms"] = []any{map[string]any{"uid": "sword", "key": "program-sword", "rez": 0}, map[string]any{"uid": "hellbolt", "key": "program-hellbolt", "rez": 0}}
		net["nodes"] = []any{map[string]any{"uid": "ice", "type": "blackIce", "rez": 20, "defense": 2}}
	})
	if _, _, e := Resolve(raw, RollRequest{Kind: "interface", Mode: "program", EntryUID: "hellbolt", TargetType: "netrunner", TargetNodeUID: "ice"}, facts, fixedDice(5)); e == nil {
		t.Fatal("antipersonnel program accepted against ICE")
	}
	next, r, e := Resolve(raw, RollRequest{Kind: "interface", Mode: "program", EntryUID: "sword", TargetNodeUID: "ice"}, facts, fixedDice(2, 8, 3, 4, 5))
	if e != nil || r.Damage != 12 || r.Success == nil || !*r.Success {
		t.Fatal(r, e)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	net := object(object(doc["values"])["netrunning"])
	if num(net["actionsRemaining"]) != 2 || num(find(net["nodes"], "uid", "ice")["rez"]) != 8 {
		t.Fatal(net)
	}
	if _, _, e = Resolve(next, RollRequest{Kind: "interface", Mode: "program", EntryUID: "sword", TargetNodeUID: "ice"}, facts, fixedDice(5)); e == nil {
		t.Fatal("program used twice")
	}
}

func TestMedicineConsumesMaterialsEvenOnFailure(t *testing.T) {
	facts := coreFacts(t)
	raw := editActor(func(v map[string]any) {
		v["roles"] = []any{map[string]any{"key": "medtech", "rank": 4, "choices": map[string]any{"pharmaceuticals": 2, "cryosystem": 1, "knownRecipes": []any{"pharma-speedheal"}}}}
		v["economy"] = map[string]any{"cashEb": 300}
	})
	next, r, e := Resolve(raw, RollRequest{Kind: "manufacture-medicine", EntryUID: "pharma-speedheal", ActionID: "batch"}, facts, fixedDice(5))
	if e != nil || r.Success == nil || !*r.Success {
		t.Fatal(r, e)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	v := object(doc["values"])
	if num(object(v["economy"])["cashEb"]) != 100 || num(find(object(v["inventory"])["entries"], "uid", "batch")["count"]) != 3 {
		t.Fatal(v)
	}
	next, r, e = Resolve(raw, RollRequest{Kind: "manufacture-medicine", EntryUID: "pharma-speedheal"}, facts, fixedDice(2))
	if e != nil || r.Success == nil || *r.Success {
		t.Fatal(r, e)
	}
	json.Unmarshal(next, &doc)
	if num(object(object(doc["values"])["economy"])["cashEb"]) != 100 {
		t.Fatal("materials not consumed")
	}
}

func TestInjuryRerollsDuplicatesAndPreservesHP(t *testing.T) {
	raw := editActor(func(v map[string]any) {
		object(v["health"])["injuries"] = []any{map[string]any{"key": "criticalinjury-broken-ribs"}}
	})
	next, r, e := Resolve(raw, RollRequest{Kind: "injury", Location: "body", ActionID: "injury"}, nil, fixedDice(2, 3, 3, 3))
	if e != nil || r.Total != 6 || r.DiceSides != 6 {
		t.Fatal(r, e)
	}
	var doc map[string]any
	json.Unmarshal(next, &doc)
	health := object(object(doc["values"])["health"])
	if num(health["current"]) != 40 || len(array(health["injuries"])) != 2 {
		t.Fatal(health)
	}
}

func TestCyberweaponRequiresAnEnabledInstallation(t *testing.T) {
	facts := coreFacts(t)
	raw := editActor(func(v map[string]any) {
		e := find(object(v["inventory"])["entries"], "uid", "gun")
		e["key"] = "cyberware-wolvers"
		e["linkedCyberUid"] = "implant"
		object(v["cyberware"])["installations"] = []any{map[string]any{"uid": "implant", "key": "cyberware-wolvers", "disabled": true}}
	})
	if _, _, err := Resolve(raw, RollRequest{Kind: "attack", EntryUID: "gun"}, facts, fixedDice(5)); err == nil {
		t.Fatal("disabled cyberweapon can attack")
	}
	raw = editActor(func(v map[string]any) {
		object(v["stats"])["BODY"] = 6
		object(v["cyberware"])["installations"] = []any{map[string]any{"uid": "frame", "key": "cyberware-implanted-linear-frame-sigma", "disabled": true}}
	})
	var doc map[string]any
	json.Unmarshal(raw, &doc)
	if MaximumHP(object(doc["values"])) != 55 {
		t.Fatal("EMP incorrectly removes the frame's structural HP")
	}
}
