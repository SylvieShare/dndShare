package store

// The limit belongs to the whole cast, including missed jumps and extra projectiles.
// An absent max_jumps leaves the existing unbounded-chain rule unchanged.
func sequenceJumpLimit(seq map[string]any) int {
	chain := object(seq["chain"])
	base := number(chain["max_jumps"])
	if base < 1 {
		return 0
	}
	extra := max(0, min(9, number(seq["castLevel"]))-max(0, number(seq["baseLevel"])))
	return min(99, base+extra*max(0, number(chain["jumps_per_slot"])))
}

// Unlike a type table, this rule examines every rolled die of the specified size.
// Other sizes and fixed bonuses cannot trigger a match; critical dice participate.
func sequenceMatchingDice(chain, result map[string]any) bool {
	sides, matches := number(chain["sides"]), number(chain["matches"])
	if sides < 2 || sides > 100 || matches < 2 || matches > 100 {
		return false
	}
	counts := map[int]int{}
	for _, raw := range array(result["parts"]) {
		part := object(raw)
		if part["kind"] != "dice" || number(part["sides"]) != sides {
			continue
		}
		for _, value := range array(part["rolls"]) {
			n := number(value)
			if n < 1 || n > sides {
				return false
			}
			counts[n]++
		}
	}
	for _, count := range counts {
		if count >= matches {
			return true
		}
	}
	return false
}
