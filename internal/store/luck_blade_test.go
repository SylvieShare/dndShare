package store

// Reconstruct the pre-107 snapshot used by the ordered migration integration test.
func stripLuckBladeSchema(field map[string]any) {
	if field["key"] != "use_resources" && field["key"] != "derived_effects" && field["key"] != "roll_triggers" {
		return
	}
	var keep []any
	for _, raw := range field["fields"].([]any) {
		child := raw.(map[string]any)
		if child["key"] == "activation" || child["key"] == "initial_charges" || child["key"] == "use_key" {
			continue
		}
		if field["key"] == "roll_triggers" && child["key"] == "event" {
			var options []any
			for _, option := range child["options"].([]any) {
				if option.(map[string]any)["value"] != "any" {
					options = append(options, option)
				}
			}
			child["options"] = options
		}
		keep = append(keep, child)
	}
	field["fields"] = keep
}
