package store

import "testing"

func TestSpellEffectBindings(t *testing.T) {
	data := map[string]any{"lvl": 3, "status_effects": []any{map[string]any{
		"key": "weapon", "parameter_bindings": []any{
			map[string]any{"key": "bonus", "source": "slot_increase", "value": 1, "step": 2, "maximum": 3},
			map[string]any{"key": "caster", "source": "casting_modifier"},
		}, "duration_levels": []any{map[string]any{"level": 5, "duration": map[string]any{"kind": "hours", "value": 8}}},
	}}}
	for _, tc := range []struct{ level, want int }{{3, 1}, {4, 1}, {5, 2}, {7, 3}, {9, 3}} {
		plan := ApplicationPlan{Effects: []ApplicationEffect{{Key: "weapon", Duration: map[string]any{"kind": "hours", "value": 1}}}}
		if err := prepareSpellEffectBindings(&plan, data, map[string]any{"INT": map[string]any{"value": 18}}, tc.level, 4); err != nil {
			t.Fatal(err)
		}
		effect := plan.Effects[0]
		if effect.Params["bonus"] != tc.want || effect.Params["caster"] != 4 {
			t.Fatalf("level %d: %+v", tc.level, effect.Params)
		}
		wantDuration := 1
		if tc.level >= 5 {
			wantDuration = 8
		}
		if number(effect.Duration["value"]) != wantDuration {
			t.Fatalf("duration: %+v", effect.Duration)
		}
	}
	link := object(array(data["status_effects"])[0])
	link["duration_levels"] = []any{map[string]any{"level": 3, "duration": map[string]any{"kind": "hours", "value": -1}}}
	plan := ApplicationPlan{Effects: []ApplicationEffect{{Key: "weapon"}}}
	if err := prepareSpellEffectBindings(&plan, data, nil, 3, 4); err == nil {
		t.Fatal("accepted invalid duration")
	}
}
