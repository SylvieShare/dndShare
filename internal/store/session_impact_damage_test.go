package store

import "testing"

func TestImpactDamage(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		amount               int
		multiplier           float64
		kinds                []string
		total, current, temp int
	}{
		{"temporary hp first", 9, 1, nil, 9, 4, 0},
		{"save halves before resistance", 15, .5, []string{"resistance", "resistance"}, 3, 10, 0},
		{"immunity wins", 15, 1, []string{"immunity", "vulnerability"}, 0, 10, 3},
		{"successful avoidance", 20, 0, nil, 0, 10, 3},
		{"floor resistance then double vulnerability", 15, 1, []string{"resistance", "vulnerability"}, 14, 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			doc := transferDocument{"values": map[string]any{"hp": map[string]any{"current": 10, "temp": 3}}}
			defenses := []any{}
			for _, kind := range tc.kinds {
				defenses = append(defenses, map[string]any{"damage_type": 5, "kind": kind})
			}
			result := applyImpactDamage(doc, []ImpactDamage{{Amount: tc.amount, TypeID: 5}}, defenses, tc.multiplier, 20)
			if result.Total != tc.total || result.After.Current != tc.current || result.After.Temp != tc.temp {
				t.Fatalf("%+v", result)
			}
			if result.Before.Current != 10 || result.Before.Temp != 3 {
				t.Fatal("lost initial HP snapshot")
			}
			if number(object(doc.values()["hp"])["current"]) != tc.current {
				t.Fatal("document not updated")
			}
		})
	}
}
