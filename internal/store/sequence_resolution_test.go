package store

import (
	"encoding/json"
	"testing"
)

func sequenceFixture(t *testing.T, source, trigger string) map[string]any {
	t.Helper()
	var seq map[string]any
	err := json.Unmarshal([]byte(`{"table":{"source":"damage","sides":8,"count":2,"rows":[{"value":3,"damage_type":5},{"value":5,"damage_type":9}]},"chain":{"trigger":"matching_damage","unique":"target"},"damageExpression":"2d8+1d6","criticalExpression":"4d8+2d6","attackBonus":4,"instances":2,"hits":[{"status":"target","attack":{"parts":[{"kind":"dice","sides":20,"rolls":[15]}]}}]}`), &seq)
	if err != nil {
		t.Fatal(err)
	}
	object(seq["table"])["source"] = source
	object(seq["chain"])["trigger"] = trigger
	return seq
}

func sequenceRolls(t *testing.T, values ...int) func(int) (int, error) {
	t.Helper()
	index := 0
	return func(sides int) (int, error) {
		t.Helper()
		if index >= len(values) || values[index] > sides {
			t.Fatalf("unexpected d%d at %d", sides, index)
		}
		value := values[index]
		index++
		return value, nil
	}
}

func TestSequenceChoosesAfterDamageAndPreservesRoll(t *testing.T) {
	seq := sequenceFixture(t, "damage", "matching_damage")
	target := ApplicationTarget{Kind: "character", CharUUID: "first"}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: target}, nil); err != nil {
		t.Fatal(err)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "hit"}, sequenceRolls(t, 3, 5, 2)); err != nil {
		t.Fatal(err)
	}
	hit := object(array(seq["hits"])[0])
	result := object(hit["result"])
	if number(result["total"]) != 10 || len(array(hit["choices"])) != 2 || hit["damageRoll"] == true {
		t.Fatal(hit)
	}
	if sequenceSelectType(hit, 13, "Холод", "blue") == nil {
		t.Fatal("unrolled type accepted")
	}
	if err := sequenceSelectType(hit, 5, "Огонь", "red"); err != nil {
		t.Fatal(err)
	}
	if number(result["total"]) != 10 || object(array(result["byType"])[0])["label"] != "Огонь" || sequenceCanContinue(seq, hit) {
		t.Fatal(hit)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "hit"}, nil); err == nil {
		t.Fatal("damage rerolled")
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "next"}, nil); err == nil {
		t.Fatal("non-double bounced")
	}
}

func TestSequenceCriticalUsesDeclaredDiceAndUniqueTargetsAcrossProjectiles(t *testing.T) {
	seq := sequenceFixture(t, "damage", "matching_damage")
	target := ApplicationTarget{Kind: "character", CharUUID: "first"}
	_ = advanceSequence(seq, SequenceCommand{Action: "target", Target: target}, nil)
	if err := advanceSequence(seq, SequenceCommand{Action: "hit", Critical: true}, sequenceRolls(t, 3, 3, 5, 5, 1, 1)); err != nil {
		t.Fatal(err)
	}
	hit := object(array(seq["hits"])[0])
	_ = sequenceSelectType(hit, 5, "Огонь", "red")
	if len(array(hit["tableValues"])) != 2 || len(array(hit["choices"])) != 1 || !sequenceCanContinue(seq, hit) {
		t.Fatal(hit)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "next"}, nil); err != nil {
		t.Fatal(err)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: target}, nil); err == nil {
		t.Fatal("repeated target accepted")
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: ApplicationTarget{Kind: "character", CharUUID: "second"}, Mode: "disadvantage"}, sequenceRolls(t, 12, 7)); err != nil {
		t.Fatal(err)
	}
	if sequenceNatural(object(object(array(seq["hits"])[1])["attack"])) != 7 {
		t.Fatal(seq)
	}
	_ = advanceSequence(seq, SequenceCommand{Action: "miss"}, nil)
	if err := advanceSequence(seq, SequenceCommand{Action: "next"}, nil); err == nil {
		t.Fatal("miss bounced")
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "projectile"}, nil); err != nil {
		t.Fatal(err)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: target}, nil); err == nil {
		t.Fatal("target reused by second projectile")
	}
}

func TestSequenceSeparateTableIsNotAddedToDamage(t *testing.T) {
	seq := sequenceFixture(t, "separate", "odd_attack")
	object(seq["table"])["count"] = 1
	_ = advanceSequence(seq, SequenceCommand{Action: "target", Target: ApplicationTarget{Kind: "character", CharUUID: "first"}}, nil)
	if err := advanceSequence(seq, SequenceCommand{Action: "hit"}, sequenceRolls(t, 5, 5, 2, 3)); err != nil {
		t.Fatal(err)
	}
	hit := object(array(seq["hits"])[0])
	_ = sequenceSelectType(hit, 5, "Огонь", "red")
	if number(object(hit["result"])["total"]) != 12 || !sequenceCanContinue(seq, hit) {
		t.Fatal(hit)
	}
	if _, err := rollSequenceDice("1d6+alert(1)", func(int) (int, error) { return 1, nil }); err == nil {
		t.Fatal("invalid expression accepted")
	}
}
