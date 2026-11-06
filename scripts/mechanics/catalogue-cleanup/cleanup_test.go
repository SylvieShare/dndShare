package main

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestWeaponCleanupChecksEachRowAndBothDamageArrays(t *testing.T) {
	raw := json.RawMessage(`{"custom":9007199254740993,"attacks":[{"v":"1d8","dice_id":"d8","type":2},{"v":"1","type":1}],
		"universe_attacks":[{"v":"2d10","count":2,"dice_id":"d10"},{"count":3}]}`)
	next, counts, err := cleanRecord(12, 1, raw, nil)
	if err != nil || counts != (cleanupCounts{weapon: 3}) {
		t.Fatalf("first pass: %+v %v", counts, err)
	}
	if bytes.Contains(next, []byte(`"v":`)) || !bytes.Contains(next, []byte(`9007199254740993`)) || !bytes.Contains(next, []byte(`"type":1`)) {
		t.Fatal(string(next))
	}
	again, counts, err := cleanRecord(12, 1, next, nil)
	if err != nil || counts != (cleanupCounts{}) || !bytes.Equal(again, next) {
		t.Fatal("second pass changed the record")
	}
	for _, invalid := range []string{
		`{"attacks":[{"v":"1d4","count":1,"dice_id":"d4"}],"universe_attacks":[{"v":"1","dice_id":"d4"}]}`,
		`{"attacks":[{"v":"1d8","count":0,"dice_id":"d8"}]}`,
		`{"attacks":[{"v":"13","dice_id":"3"}]}`,
	} {
		if next, _, err := cleanRecord(12, 1, json.RawMessage(invalid), nil); err == nil || next != nil {
			t.Fatalf("unverified damage accepted: %s", invalid)
		}
	}
}

func TestRemoveOnlyReviewedSpellTextAndRedundantPotionFlags(t *testing.T) {
	var reviews map[int64]spellText
	if err := json.Unmarshal(spellReview, &reviews); err != nil {
		t.Fatal(err)
	}
	for id, review := range reviews {
		desc := "<p>Описание</p>" + review.Paragraph
		raw, _ := json.Marshal(map[string]string{"upper": review.Legacy, "description": desc})
		next, counts, err := cleanRecord(id, 5, raw, reviews)
		var data map[string]string
		if err != nil || counts.spells != 1 || json.Unmarshal(next, &data) != nil || len(data) != 1 || data["description"] != desc {
			t.Fatalf("spell %d: %s %v", id, next, err)
		}
		for _, altered := range []map[string]string{
			{"upper": review.Legacy, "description": "<p>Описание</p>"},
			{"upper": review.Legacy + " Новое условие.", "description": desc},
		} {
			raw, _ := json.Marshal(altered)
			if _, _, err := cleanRecord(id, 5, raw, reviews); err == nil {
				t.Fatalf("removed unreviewed text on %d", id)
			}
		}
	}
	next, counts, err := cleanRecord(84, 10, json.RawMessage(`{"consumable":true,"usable":{"healing":"2d4+2"}}`), nil)
	if err != nil || counts.potions != 1 || string(next) != `{"usable":{"healing":"2d4+2"}}` {
		t.Fatalf("potion: %s %v", next, err)
	}
	if _, _, err := cleanRecord(84, 10, json.RawMessage(`{"consumable":false}`), nil); err == nil {
		t.Fatal("overrode an explicit conflicting catalogue flag")
	}
}
