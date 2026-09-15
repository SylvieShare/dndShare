package store

import "math"

// Freeze caster- and slot-dependent parameters on the accepted effect instance.
// Recipients never derive these values from their own level or ability score.
func prepareSpellEffectBindings(plan *ApplicationPlan, data, values map[string]any, level, ability int) error {
	for i := range plan.Effects {
		effect := &plan.Effects[i]
		for _, raw := range array(data["status_effects"]) {
			link := object(raw)
			if textValue(link["key"]) != effect.Key {
				continue
			}
			for _, value := range array(link["parameter_bindings"]) {
				binding := object(value)
				source := 0
				switch binding["source"] {
				case "slot_increase":
					source = max(0, level-number(data["lvl"]))
				case "casting_modifier":
					source = spellAbilityModifier(values, ability)
				case "cast_level":
					source = level
				default:
					continue
				}
				multiplier := 1
				if v, exists := binding["multiplier"]; exists {
					multiplier = number(v)
				}
				n := number(binding["value"]) + int(math.Floor(float64(source)/float64(max(1, number(binding["step"])))))*multiplier
				if v, exists := binding["minimum"]; exists {
					n = max(n, number(v))
				}
				if v, exists := binding["maximum"]; exists {
					n = min(n, number(v))
				}
				if effect.Params == nil {
					effect.Params = map[string]any{}
				}
				effect.Params[textValue(binding["key"])] = n
			}
			best := -1
			for _, value := range array(link["duration_levels"]) {
				row := object(value)
				threshold := number(row["level"])
				if threshold <= level && threshold > best {
					best = threshold
					duration := object(row["duration"])
					if err := validateApplicationDuration(duration); err != nil {
						return err
					}
					effect.Duration = duration
				}
			}
		}
	}
	return nil
}
