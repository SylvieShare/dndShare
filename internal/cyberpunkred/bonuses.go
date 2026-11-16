package cyberpunkred

func activeBonuses(values map[string]any, facts map[string]map[string]any, kind string) map[string]int {
	result := map[string]int{}
	apply := func(entry map[string]any, installed bool) {
		if entry["disabled"] == true {
			return
		}
		if !installed && entry["equipped"] != true {
			return
		}
		key := str(entry["key"])
		installedCount := func(want string) int {
			n := 0
			for _, raw := range array(object(values["cyberware"])["installations"]) {
				e := object(raw)
				if e["key"] == want && e["disabled"] != true {
					n++
				}
			}
			return n
		}
		if key == "cyberware-chemskin" || key == "cyberware-techhair" && installedCount("cyberware-chemskin") == 0 || key == "cyberware-light-tattoo" && installedCount(key) < 3 {
			return
		}
		if key == "drug-black-lace" && entry["phase"] == "secondary" {
			for _, raw := range array(object(values["health"])["conditions"]) {
				e := object(raw)
				if e["key"] == key && e["phase"] == "primary" {
					return
				}
			}
		}
		if key == "cyberware-sandevistan" && entry["active"] != true {
			return
		}
		f := facts[key]
		if f["programClass"] != nil {
			return
		}
		if f["paired"] == true {
			parents := map[string]bool{}
			for _, e := range array(object(values["cyberware"])["installations"]) {
				if str(object(e)["key"]) == key {
					if parent := str(object(e)["parentUid"]); parent != "" {
						parents[parent] = true
					}
				}
			}
			if len(parents) < 2 {
				return
			}
		}
		for _, raw := range array(f["bonuses"]) {
			b := object(raw)
			if str(b["phase"]) != "" && b["phase"] != entry["phase"] {
				continue
			}
			target := str(b["target"])
			if b["conditional"] == true {
				enabled := false
				for _, name := range array(entry["enabledBonuses"]) {
					if str(name) == target {
						enabled = true
					}
				}
				if !enabled {
					continue
				}
			}
			value := num(b["value"])
			// Multiple copies of the same enhancement do not stack.
			identity := key
			if phase := str(b["phase"]); phase != "" {
				identity += "@" + phase
			}
			previous, exists := result[identity+"|"+target]
			if !exists || value > previous {
				result[identity+"|"+target] = value
			}
		}
	}
	for _, e := range array(object(values["inventory"])["entries"]) {
		apply(object(e), false)
	}
	for _, e := range array(object(values["cyberware"])["installations"]) {
		apply(object(e), true)
	}
	for _, e := range array(object(values["health"])["conditions"]) {
		apply(object(e), true)
	}
	for _, e := range array(object(values["health"])["conditions"]) {
		c := object(e)
		if c["disabled"] == true {
			continue
		}
		for _, raw := range array(c["bonuses"]) {
			b := object(raw)
			result[str(c["uid"])+"|"+str(b["target"])] = num(b["value"])
		}
	}
	if kind != "initiative" {
		for _, injury := range array(object(values["health"])["injuries"]) {
			apply(object(injury), true)
		}
	}
	totals := map[string]int{}
	for key, value := range result {
		for i, c := range key {
			if c == '|' {
				totals[key[i+1:]] += value
				break
			}
		}
	}
	return totals
}
