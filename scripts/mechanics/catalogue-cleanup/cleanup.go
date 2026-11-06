package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// These two passages per spell were compared in the published 2014 records.
// Removing a changed paragraph requires a fresh content review.
//
//go:embed reviewed_spells.json
var spellReview []byte

type spellText struct {
	Legacy    string `json:"legacy"`
	Paragraph string `json:"paragraph"`
}

type fields = map[string]json.RawMessage
type cleanupCounts struct{ weapon, spells, potions int }

var diceID = regexp.MustCompile(`^d[1-9][0-9]*$`)

func cleanDamage(data fields, key string) (int, error) {
	raw := data[key]
	if len(raw) == 0 {
		return 0, nil
	}
	var rows []fields
	if err := json.Unmarshal(raw, &rows); err != nil {
		return 0, err
	}
	removed := 0
	for i, row := range rows {
		legacy, present := row["v"]
		if !present {
			continue
		}
		count := 1
		if n := row["count"]; len(n) > 0 && !bytes.Equal(n, []byte("null")) {
			if err := json.Unmarshal(n, &count); err != nil || count < 1 {
				return 0, fmt.Errorf("%s[%d]: invalid count %s", key, i, n)
			}
		}
		var die, formula string
		if rawDie := row["dice_id"]; len(rawDie) > 0 {
			if err := json.Unmarshal(rawDie, &die); err != nil || (die != "" && !diceID.MatchString(die)) {
				return 0, fmt.Errorf("%s[%d]: unrecognized die %s", key, i, rawDie)
			}
		}
		expected := strconv.Itoa(count) + die
		if err := json.Unmarshal(legacy, &formula); err != nil || strings.TrimSpace(formula) != expected {
			return 0, fmt.Errorf("%s[%d]: old damage %s differs from %q", key, i, legacy, expected)
		}
		delete(row, "v")
		removed++
	}
	if removed > 0 {
		updated, err := json.Marshal(rows)
		if err != nil {
			return 0, err
		}
		data[key] = updated
	}
	return removed, nil
}

func cleanRecord(id int64, kind int, raw json.RawMessage, reviews map[int64]spellText) (json.RawMessage, cleanupCounts, error) {
	var counts cleanupCounts
	var data fields
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, counts, err
	}
	switch kind {
	case 1:
		for _, key := range []string{"attacks", "universe_attacks"} {
			n, err := cleanDamage(data, key)
			if err != nil {
				return nil, counts, err
			}
			counts.weapon += n
		}
	case 5:
		if legacy, present := data["upper"]; present {
			var upper, desc string
			review, ok := reviews[id]
			if !ok || json.Unmarshal(legacy, &upper) != nil || upper != review.Legacy ||
				json.Unmarshal(data["description"], &desc) != nil || review.Paragraph == "" || !strings.Contains(desc, review.Paragraph) {
				return nil, counts, fmt.Errorf("higher-level text differs from the reviewed description")
			}
			delete(data, "upper")
			counts.spells++
		}
	case 10:
		if flag, present := data["consumable"]; present {
			if !bytes.Equal(flag, []byte("true")) {
				return nil, counts, fmt.Errorf("potion flag %s differs from the type default", flag)
			}
			delete(data, "consumable")
			counts.potions++
		}
	}
	if counts == (cleanupCounts{}) {
		return raw, counts, nil
	}
	next, err := json.Marshal(data)
	return next, counts, err
}
