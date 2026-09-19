package store

import "testing"

func TestSequenceMatchingAnyPairAndCastLimit(t *testing.T) {
	seq := sequenceFixture(t, "damage", "matching_dice")
	delete(seq, "table")
	seq["damageExpression"] = "4d8+1d6"
	seq["criticalExpression"] = "8d8+2d6"
	seq["castLevel"], seq["baseLevel"] = 2, 1
	chain := object(seq["chain"])
	chain["sides"], chain["matches"], chain["max_jumps"], chain["jumps_per_slot"] = 8, 2, 1, 1
	first := ApplicationTarget{Kind: "character", CharUUID: "one"}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: first}, nil); err != nil {
		t.Fatal(err)
	}
	// The pair occurs late in the pool, not just in the first two d8.
	if err := advanceSequence(seq, SequenceCommand{Action: "hit"}, sequenceRolls(t, 1, 2, 7, 7, 3)); err != nil {
		t.Fatal(err)
	}
	hit := object(array(seq["hits"])[0])
	if !sequenceCanContinue(seq, hit) || sequenceJumpLimit(seq) != 2 {
		t.Fatal(seq)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "next"}, nil); err != nil {
		t.Fatal(err)
	}
	if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: first}, nil); err == nil {
		t.Fatal("reused target")
	}
	for _, id := range []string{"two", "three"} {
		if err := advanceSequence(seq, SequenceCommand{Action: "target", Target: ApplicationTarget{Kind: "character", CharUUID: id}}, sequenceRolls(t, 12)); err != nil {
			t.Fatal(err)
		}
		if err := advanceSequence(seq, SequenceCommand{Action: "hit", Critical: true}, sequenceRolls(t, 1, 2, 3, 4, 5, 6, 7, 7, 1, 2)); err != nil {
			t.Fatal(err)
		}
		err := advanceSequence(seq, SequenceCommand{Action: "next"}, nil)
		if id == "two" && err != nil {
			t.Fatal(err)
		}
		if id == "three" && err == nil {
			t.Fatal("cast limit exceeded")
		}
	}
}
func TestSequenceMatchingIgnoresOtherDiceAndRequiresHit(t *testing.T) {
	seq := sequenceFixture(t, "damage", "matching_dice")
	delete(seq, "table")
	chain := object(seq["chain"])
	chain["sides"], chain["matches"] = 8, 2
	hit := object(array(seq["hits"])[0])
	hit["status"] = "attack"
	if err := advanceSequence(seq, SequenceCommand{Action: "hit"}, sequenceRolls(t, 3, 5, 3)); err != nil {
		t.Fatal(err)
	}
	if sequenceCanContinue(seq, hit) {
		t.Fatal("d6 counted as matching d8")
	}
	chain["trigger"] = "always"
	hit["status"] = "miss"
	if sequenceCanContinue(seq, hit) {
		t.Fatal("miss continued")
	}
}
